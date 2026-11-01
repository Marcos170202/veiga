/* Agente Sentinela — vigia vencimentos, orçamentos estourados, duplicidades e a reserva. */
FC.agentes.sentinela = (() => {
  const O = FC.orquestrador;
  const U = FC.util;
  const st = () => FC.store.estado;
  O.registrar({
    id: 'sentinela', nome: 'Sentinela', sigla: 'SE',
    papel: 'Avisa sobre contas atrasadas ou vencendo, orçamento no limite, possíveis duplicidades e reserva baixa.',
  });

  function pareceDuplicado(r) {
    const desc = U.normalizar(r.descricao).split(' ')[0];
    return st().lancamentos.some((l) =>
      (r.linhaDigitavel && l.linhaDigitavel === r.linhaDigitavel) ||
      (Math.abs(l.valor - r.valor) < 0.01 && Math.abs(U.diasEntre(l.data, r.data)) <= 3 && U.normalizar(l.descricao).startsWith(desc)));
  }

  /* Retorna alertas ordenados por gravidade: critico > atencao > info */
  function alertas(ym) {
    const T = FC.agentes.tesoureiro;
    const P = FC.agentes.planejador;
    const h = U.hoje();
    const out = [];
    const abertos = st().lancamentos.filter((l) => l.tipo === 'despesa' && l.status !== 'pago');

    const atrasados = abertos.filter((l) => l.vencimento < h);
    if (atrasados.length) out.push({ nivel: 'critico', titulo: `${atrasados.length} conta(s) atrasada(s)`, texto: atrasados.slice(0, 3).map((l) => `${l.descricao} (${U.dataBR(l.vencimento)})`).join(', '), total: atrasados.reduce((s, l) => s + l.valor, 0), aba: 'pagar' });

    const em3 = abertos.filter((l) => l.vencimento >= h && U.diasEntre(h, l.vencimento) <= 3);
    if (em3.length) out.push({ nivel: 'atencao', titulo: `${em3.length} conta(s) vencem em até 3 dias`, texto: em3.slice(0, 3).map((l) => `${l.descricao} — ${U.dataCurta(l.vencimento)}`).join(', '), total: em3.reduce((s, l) => s + l.valor, 0), aba: 'pagar' });

    P.orcamentos(ym).filter((c) => c.orcamento && c.pct >= 90).sort((a, b) => b.pct - a.pct).slice(0, 3).forEach((c) => {
      out.push({ nivel: c.pct > 100 ? 'critico' : 'atencao', titulo: c.pct > 100 ? `${c.nome}: orçamento estourado` : `${c.nome}: ${Math.round(c.pct)}% do orçamento`, texto: `${U.moeda(c.gasto)} de ${U.moeda(c.orcamento)} previstos.`, aba: 'orcamento' });
    });

    const t = T.totais(ym);
    if (ym === U.mesDe(h) && t.receitas && t.despesas > t.receitas) out.push({ nivel: 'critico', titulo: 'Despesas acima da renda no mês', texto: `Faltam ${U.moeda(t.despesas - t.receitas)} para fechar no azul.`, aba: 'relatorios' });

    const r = P.reserva(ym);
    if (r.alvo && r.pct < 50) out.push({ nivel: 'atencao', titulo: 'Reserva de emergência abaixo da metade', texto: `Cobre ${r.meses.toFixed(1)} de ${st().config.reservaMeses} meses de custo essencial.`, aba: 'metas' });

    const mes = st().lancamentos.filter((l) => U.mesDe(l.data) === ym);
    const vistos = new Map(); let dup = 0;
    mes.forEach((l) => { const k = `${l.valor}|${U.normalizar(l.descricao)}`; if (vistos.has(k) && Math.abs(U.diasEntre(vistos.get(k), l.data)) <= 3) dup++; vistos.set(k, l.data); });
    if (dup) out.push({ nivel: 'info', titulo: `${dup} possível(is) lançamento(s) duplicado(s)`, texto: 'Mesmo valor e descrição com até 3 dias de diferença.', aba: 'lancamentos' });

    const ordem = { critico: 0, atencao: 1, info: 2 };
    return out.sort((a, b) => ordem[a.nivel] - ordem[b.nivel]);
  }

  function varredura(ym) {
    const a = alertas(ym);
    O.log('sentinela', a.length ? `Varredura: ${a.length} alerta(s) — ${a.map((x) => x.titulo).join('; ')}.` : 'Varredura: nada fora do lugar.');
    return a;
  }

  return { alertas, varredura, pareceDuplicado };
})();
