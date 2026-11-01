/* Agente Analista — séries, comparativos e observações escritas sobre o mês. */
FC.agentes.analista = (() => {
  const O = FC.orquestrador;
  const U = FC.util;
  const T = () => FC.agentes.tesoureiro;
  O.registrar({
    id: 'analista', nome: 'Analista', sigla: 'AN',
    papel: 'Monta séries mensais, compara meses, projeta o fechamento e escreve observações.',
  });

  function serie(ym, n = 12, conta) {
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const m = U.somaMes(ym, -i);
      const t = T().totais(m, conta);
      out.push({ ym: m, receitas: t.receitas, despesas: t.despesas, saldo: t.saldo });
    }
    return out;
  }

  function porCategoria(ym, conta) {
    const g = {};
    T().doMes(ym, { conta, tipo: 'despesa' }).forEach((l) => { g[l.categoriaId] = (g[l.categoriaId] || 0) + l.valor; });
    return Object.entries(g).map(([id, valor]) => ({ id, nome: FC.store.categoria(id).nome, valor })).sort((a, b) => b.valor - a.valor);
  }

  function porEstabelecimento(ym, conta, n = 8) {
    const g = {};
    T().doMes(ym, { conta, tipo: 'despesa' }).forEach((l) => {
      const k = l.descricao.replace(/\s*[—-]\s*parcela.*$/i, '').trim();
      g[k] = g[k] || { nome: k, valor: 0, vezes: 0 };
      g[k].valor += l.valor; g[k].vezes++;
    });
    return Object.values(g).sort((a, b) => b.valor - a.valor).slice(0, n);
  }

  function observacoes(ym, conta) {
    const obs = [];
    const t = T().totais(ym, conta);
    const ant = T().totais(U.somaMes(ym, -1), conta);
    if (ant.despesas) {
      const v = (t.despesas - ant.despesas) / ant.despesas * 100;
      obs.push(`Despesas ${v >= 0 ? 'subiram' : 'caíram'} ${Math.abs(v).toFixed(0)}% em relação a ${U.mesLabel(U.somaMes(ym, -1))}.`);
    }
    const atual = Object.fromEntries(porCategoria(ym, conta).map((c) => [c.id, c.valor]));
    const passado = Object.fromEntries(porCategoria(U.somaMes(ym, -1), conta).map((c) => [c.id, c.valor]));
    const difs = Object.keys({ ...atual, ...passado }).map((id) => ({ id, d: (atual[id] || 0) - (passado[id] || 0) })).sort((a, b) => b.d - a.d);
    if (difs[0] && difs[0].d > 50) obs.push(`${FC.store.categoria(difs[0].id).nome} foi o que mais cresceu: +${U.moeda(difs[0].d)}.`);
    const fim = difs[difs.length - 1];
    if (fim && fim.d < -50) obs.push(`${FC.store.categoria(fim.id).nome} foi onde mais economizaram: ${U.moeda(fim.d)}.`);
    if (t.receitas) {
      const taxa = (t.receitas - t.despesas) / t.receitas * 100;
      obs.push(taxa >= 0 ? `Taxa de poupança do mês: ${taxa.toFixed(0)}% da renda.` : `O mês fecha ${U.moeda(-t.saldo)} no vermelho.`);
    }
    const h = U.hoje();
    if (ym === U.mesDe(h)) {
      const dia = +h.slice(8, 10);
      const diasMes = new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate();
      const variaveis = T().doMes(ym, { conta, tipo: 'despesa' }).filter((l) => !l.recorrente && !l.parcela && l.data <= h).reduce((s, l) => s + l.valor, 0);
      if (dia > 3) obs.push(`No ritmo atual, gastos variáveis devem fechar o mês em ~${U.moeda(variaveis / dia * diasMes)}.`);
    }
    const top = porEstabelecimento(ym, conta, 1)[0];
    if (top) obs.push(`Maior destino do dinheiro: ${top.nome} (${U.moeda(top.valor)}).`);
    return obs;
  }

  function relatorioTexto(ym) {
    const t = T().totais(ym);
    const linhas = [
      `Resumo financeiro — ${U.mesLabel(ym)}`,
      '',
      `Receitas: ${U.moeda(t.receitas)}`,
      `Despesas: ${U.moeda(t.despesas)} (pagas ${U.moeda(t.pago)}, em aberto ${U.moeda(t.aPagar)})`,
      `Saldo: ${U.moeda(t.saldo)}`,
      '',
      'Por categoria:',
      ...porCategoria(ym).map((c) => `  ${c.nome}: ${U.moeda(c.valor)}`),
      '',
      'Observações:',
      ...observacoes(ym).map((o) => `  • ${o}`),
      '',
      `Conta conjunta: ${FC.agentes.divisor.frase(FC.agentes.divisor.acerto(ym))}`,
    ];
    O.log('analista', `Gerei o resumo de ${U.mesLabel(ym)}.`);
    return linhas.join('\n');
  }

  return { serie, porCategoria, porEstabelecimento, observacoes, relatorioTexto };
})();
