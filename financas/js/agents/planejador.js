/* Agente Planejador — orçamento por categoria, divisão da renda em reservas e metas. */
FC.agentes.planejador = (() => {
  const O = FC.orquestrador;
  const U = FC.util;
  const T = () => FC.agentes.tesoureiro;
  const st = () => FC.store.estado;
  O.registrar({
    id: 'planejador', nome: 'Planejador', sigla: 'PL',
    papel: 'Divide a renda entre essenciais, pessoal, reserva e metas; acompanha orçamentos e objetivos.',
  });

  const BALDES = [
    { id: 'essenciais', nome: 'Essenciais', desc: 'moradia, contas, mercado, saúde, transporte' },
    { id: 'pessoal', nome: 'Gastos pessoais', desc: 'lazer, restaurantes, compras, assinaturas' },
    { id: 'reserva', nome: 'Reserva e investimentos', desc: 'reserva de emergência e aportes' },
    { id: 'metas', nome: 'Metas', desc: 'casamento, viagem, apartamento' },
  ];

  function baldeDe(l) {
    if (l.categoriaId === 'investimentos') return 'reserva';
    const g = FC.store.categoria(l.categoriaId).grupo;
    return g === 'essenciais' || g === 'pessoal' || g === 'metas' ? g : 'pessoal';
  }

  function alocacao(ym, conta) {
    const t = T().totais(ym, conta);
    const renda = t.receitas;
    const real = { essenciais: 0, pessoal: 0, reserva: 0, metas: 0 };
    T().doMes(ym, { conta, tipo: 'despesa' }).forEach((l) => { real[baldeDe(l)] += l.valor; });
    const pct = st().config.alocacao;
    return BALDES.map((b) => ({
      ...b,
      pctPlano: pct[b.id],
      plano: renda * pct[b.id] / 100,
      real: real[b.id],
      pctReal: renda ? real[b.id] / renda * 100 : 0,
    })).concat([{ id: 'sobra', nome: 'Sobra do mês', real: Math.max(0, renda - t.despesas), pctReal: renda ? Math.max(0, renda - t.despesas) / renda * 100 : 0 }]);
  }

  function orcamentos(ym) {
    const gastos = {};
    T().doMes(ym, { tipo: 'despesa' }).forEach((l) => { gastos[l.categoriaId] = (gastos[l.categoriaId] || 0) + l.valor; });
    return st().categorias.filter((c) => c.grupo !== 'receita').map((c) => ({
      ...c, gasto: gastos[c.id] || 0, pct: c.orcamento ? (gastos[c.id] || 0) / c.orcamento * 100 : 0,
    }));
  }

  function mediaEssenciais(ym, meses = 3) {
    let soma = 0;
    for (let i = 1; i <= meses; i++) {
      T().doMes(U.somaMes(ym, -i), { tipo: 'despesa' }).forEach((l) => { if (baldeDe(l) === 'essenciais') soma += l.valor; });
    }
    return soma / meses;
  }

  function reserva(ym) {
    const meta = st().metas.find((m) => m.id === 'reserva') || { guardado: 0 };
    const custo = mediaEssenciais(ym) || T().totais(ym).despesas;
    const alvo = custo * st().config.reservaMeses;
    return { guardado: meta.guardado, alvo, custoMensal: custo, meses: custo ? meta.guardado / custo : 0, pct: alvo ? Math.min(100, meta.guardado / alvo * 100) : 0 };
  }

  function metas() {
    const h = U.hoje();
    return st().metas.map((m) => {
      const alvo = m.especial ? reserva(U.mesDe(h)).alvo : m.alvo;
      const falta = Math.max(0, alvo - m.guardado);
      const meses = m.prazo ? Math.max(1, Math.ceil(U.diasEntre(h, m.prazo) / 30.44)) : 0;
      return { ...m, alvo, falta, meses, porMes: meses ? falta / meses : 0, pct: alvo ? Math.min(100, m.guardado / alvo * 100) : 0 };
    });
  }

  function salvarAlocacao(novo) {
    const soma = Object.values(novo).reduce((a, b) => a + Number(b), 0);
    if (Math.round(soma) !== 100) return `A soma precisa dar 100% (está em ${soma}%).`;
    st().config.alocacao = Object.fromEntries(Object.entries(novo).map(([k, v]) => [k, Number(v)]));
    FC.store.salvar();
    O.log('planejador', `Nova divisão da renda: ${BALDES.map((b) => `${b.nome} ${novo[b.id]}%`).join(', ')}.`);
    return null;
  }

  function aportar(metaId, valor, lancar, conta) {
    const m = st().metas.find((x) => x.id === metaId);
    if (!m) return;
    m.guardado = Math.round((m.guardado + valor) * 100) / 100;
    if (lancar && valor > 0) {
      T().adicionar({
        descricao: `Aporte — ${m.nome}`, valor, data: U.hoje(), categoriaId: 'investimentos',
        conta, status: 'pago', forma: 'pix', origem: 'manual',
      }, { silencioso: true });
    }
    FC.store.salvar();
    O.log('planejador', `${valor >= 0 ? 'Aporte' : 'Retirada'} de ${U.moeda(Math.abs(valor))} em "${m.nome}" — agora ${U.moeda(m.guardado)}.`);
  }

  return { BALDES, baldeDe, alocacao, orcamentos, reserva, metas, salvarAlocacao, aportar, mediaEssenciais };
})();
