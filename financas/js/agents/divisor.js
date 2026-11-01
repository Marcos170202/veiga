/* Agente Divisor — conta conjunta do casal: quanto cada um deveria pagar e quem acerta com quem. */
FC.agentes.divisor = (() => {
  const O = FC.orquestrador;
  const U = FC.util;
  const T = () => FC.agentes.tesoureiro;
  const st = () => FC.store.estado;
  O.registrar({
    id: 'divisor', nome: 'Divisor', sigla: 'DI',
    papel: 'Divide as despesas conjuntas (meio a meio, proporcional à renda ou personalizado) e calcula o acerto.',
  });

  function percentualA(ym) {
    const d = st().config.divisao;
    if (d.modo === 'igual') return 50;
    if (d.modo === 'custom') return Number(d.pctA) || 50;
    const ra = T().totais(ym, 'a').receitas;
    const rb = T().totais(ym, 'b').receitas;
    return ra + rb ? ra / (ra + rb) * 100 : 50;
  }

  function acerto(ym) {
    const pctA = percentualA(ym);
    const desp = T().doMes(ym, { conta: 'casal', tipo: 'despesa' });
    const pagas = desp.filter((l) => l.status === 'pago');
    const total = pagas.reduce((s, l) => s + l.valor, 0);
    const pagoA = pagas.filter((l) => l.pagoPor === 'a').reduce((s, l) => s + l.valor, 0);
    const pagoB = total - pagoA;
    const devidoA = total * pctA / 100;
    const acertado = (st().acertos || []).filter((x) => x.ym === ym).reduce((s, x) => s + x.valor, 0);
    const saldoA = pagoA - devidoA - acertado; // > 0: B deve para A
    const aberto = desp.filter((l) => l.status !== 'pago').reduce((s, l) => s + l.valor, 0);
    return { pctA, pctB: 100 - pctA, acertado, total, pagoA, pagoB, devidoA, devidoB: total - devidoA, saldoA, aberto, itens: desp };
  }

  function historico(n = 6, ym) {
    const out = [];
    for (let i = n - 1; i >= 0; i--) { const m = U.somaMes(ym, -i); out.push({ ym: m, ...acerto(m) }); }
    return out;
  }

  function frase(a) {
    const p = st().config.pessoas;
    if (!a.total) return a.aberto ? `Nenhuma despesa conjunta paga ainda — ${U.moeda(a.aberto)} em aberto.` : 'Sem despesas conjuntas neste mês.';
    if (Math.abs(a.saldoA) < 1) return 'Tudo certo: as contas conjuntas estão equilibradas.';
    return a.saldoA > 0
      ? `${p.b} transfere ${U.moeda(a.saldoA)} para ${p.a}.`
      : `${p.a} transfere ${U.moeda(-a.saldoA)} para ${p.b}.`;
  }

  /* O acerto fica registrado e abate a diferença daquele mês. */
  function registrarAcerto(ym) {
    const a = acerto(ym);
    if (Math.abs(a.saldoA) < 1) return;
    st().acertos = st().acertos || [];
    st().acertos.push({ ym, valor: Math.round(a.saldoA * 100) / 100, em: U.hoje() });
    FC.store.salvar();
    O.log('divisor', `Acerto de ${U.mesLabel(ym)} registrado: ${frase(a)}`);
  }

  return { percentualA, acerto, historico, frase, registrarAcerto };
})();
