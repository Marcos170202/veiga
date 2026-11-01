/* Agente Tesoureiro — dono dos lançamentos: cria, edita, parcela, marca pago e gera recorrências. */
FC.agentes.tesoureiro = (() => {
  const O = FC.orquestrador;
  const U = FC.util;
  const st = () => FC.store.estado;
  O.registrar({
    id: 'tesoureiro', nome: 'Tesoureiro', sigla: 'TE',
    papel: 'Mantém os lançamentos, status de pagamento, parcelas e contas recorrentes do mês.',
  });

  /* pago | atrasado | hoje | pendente */
  function situacao(l) {
    if (l.status === 'pago') return 'pago';
    const h = U.hoje();
    if (l.vencimento < h) return 'atrasado';
    if (l.vencimento === h) return 'hoje';
    return 'pendente';
  }

  function doMes(ym, f = {}) {
    const busca = U.normalizar(f.busca || '');
    return st().lancamentos.filter((l) => {
      if (U.mesDe(l.data) !== ym) return false;
      if (f.conta && f.conta !== 'todas' && l.conta !== f.conta) return false;
      if (f.tipo && f.tipo !== 'todos' && l.tipo !== f.tipo) return false;
      if (f.categoriaId && f.categoriaId !== 'todas' && l.categoriaId !== f.categoriaId) return false;
      if (f.situacao && f.situacao !== 'todas') {
        const s = situacao(l);
        if (f.situacao === 'aberto' ? s === 'pago' : s !== f.situacao) return false;
      }
      if (busca && !U.normalizar(`${l.descricao} ${l.notas} ${FC.store.categoria(l.categoriaId).nome}`).includes(busca)) return false;
      return true;
    }).sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
  }

  function totais(ym, conta) {
    const lista = doMes(ym, { conta });
    const t = { receitas: 0, despesas: 0, pago: 0, aPagar: 0, atrasado: 0, n: lista.length };
    lista.forEach((l) => {
      if (l.tipo === 'receita') t.receitas += l.valor;
      else {
        t.despesas += l.valor;
        const s = situacao(l);
        if (s === 'pago') t.pago += l.valor; else t.aPagar += l.valor;
        if (s === 'atrasado') t.atrasado += l.valor;
      }
    });
    t.saldo = t.receitas - t.despesas;
    return t;
  }

  function normalizar(d) {
    const l = Object.assign({
      id: U.uid(), tipo: 'despesa', conta: 'casal', pagoPor: 'a', status: 'pendente', pagoEm: '',
      forma: 'pix', recorrente: false, origem: 'manual', notas: '', categoriaId: 'outros',
    }, d);
    l.valor = Math.round(U.parseValor(l.valor) * 100) / 100;
    l.vencimento = l.vencimento || l.data;
    if (l.conta !== 'casal') l.pagoPor = l.conta;
    if (l.status === 'pago' && !l.pagoEm) l.pagoEm = U.hoje();
    delete l.duplicado; delete l.texto; delete l.motivo; delete l.confiancaExtracao; delete l.interno; delete l.contraparte;
    return l;
  }

  function adicionar(d, { silencioso = false } = {}) {
    const base = normalizar(d);
    const novos = [];
    if (base.parcela && base.parcela.total > 1 && !d.id) {
      // cria as parcelas restantes nos meses seguintes
      const desc = base.descricao.replace(/\s*[—-]?\s*parcela\s*\d+\/\d+$/i, '');
      for (let n = base.parcela.n; n <= base.parcela.total; n++) {
        const k = n - base.parcela.n;
        const ym = U.somaMes(U.mesDe(base.data), k);
        novos.push(Object.assign({}, base, {
          id: U.uid(),
          descricao: `${desc} — parcela ${n}/${base.parcela.total}`,
          data: U.mesmoDiaNoMes(base.data, ym),
          vencimento: U.mesmoDiaNoMes(base.vencimento, U.somaMes(U.mesDe(base.vencimento), k)),
          parcela: { n, total: base.parcela.total },
          status: k === 0 ? base.status : 'pendente',
          pagoEm: k === 0 ? base.pagoEm : '',
        }));
      }
    } else novos.push(base);
    st().lancamentos.push(...novos);
    FC.store.salvar();
    if (!silencioso) O.log('tesoureiro', novos.length > 1
      ? `Lancei "${base.descricao}" em ${novos.length} parcelas de ${U.moeda(base.valor)}.`
      : `Lancei ${base.tipo === 'receita' ? 'receita' : 'despesa'} "${base.descricao}" de ${U.moeda(base.valor)} (${FC.store.nomeConta(base.conta)}).`);
    return novos;
  }

  function atualizar(id, d) {
    const l = st().lancamentos.find((x) => x.id === id);
    if (!l) return;
    const antes = l.categoriaId;
    Object.assign(l, normalizar(Object.assign({}, l, d)));
    if (d.categoriaId && d.categoriaId !== antes && l.origem !== 'manual') FC.agentes.classificador.aprender(l.descricao, d.categoriaId);
    FC.store.salvar();
    O.log('tesoureiro', `Atualizei "${l.descricao}".`);
  }

  function remover(id) {
    const i = st().lancamentos.findIndex((x) => x.id === id);
    if (i < 0) return;
    const [l] = st().lancamentos.splice(i, 1);
    FC.store.salvar();
    O.log('tesoureiro', `Removi "${l.descricao}" (${U.moeda(l.valor)}).`);
  }

  function alternarPago(id) {
    const l = st().lancamentos.find((x) => x.id === id);
    if (!l) return;
    l.status = l.status === 'pago' ? 'pendente' : 'pago';
    l.pagoEm = l.status === 'pago' ? U.hoje() : '';
    FC.store.salvar();
    O.log('tesoureiro', `"${l.descricao}" marcado como ${l.status === 'pago' ? 'pago' : 'em aberto'}.`);
  }

  function marcarPagos(ids) {
    let n = 0;
    st().lancamentos.forEach((l) => { if (ids.includes(l.id) && l.status !== 'pago') { l.status = 'pago'; l.pagoEm = U.hoje(); n++; } });
    FC.store.salvar();
    if (n) O.log('tesoureiro', `Marquei ${n} conta(s) como paga(s).`);
  }

  /* Copia as contas marcadas como recorrentes do mês anterior que ainda não existem no mês. */
  function gerarRecorrentes(ym) {
    const anterior = U.somaMes(ym, -1);
    const chave = (l) => `${U.normalizar(l.descricao)}|${l.conta}|${l.categoriaId}|${l.tipo}`;
    const existentes = new Set(st().lancamentos.filter((l) => U.mesDe(l.data) === ym).map(chave));
    const novos = st().lancamentos
      .filter((l) => l.recorrente && U.mesDe(l.data) === anterior && !existentes.has(chave(l)))
      .map((l) => Object.assign({}, l, {
        id: U.uid(),
        data: U.mesmoDiaNoMes(l.data, ym),
        vencimento: U.mesmoDiaNoMes(l.vencimento, ym),
        status: 'pendente', pagoEm: '', origem: 'recorrente',
      }));
    if (novos.length) {
      st().lancamentos.push(...novos);
      FC.store.salvar();
      O.log('tesoureiro', `Gerei ${novos.length} conta(s) recorrente(s) para ${U.mesLabel(ym)}.`);
    }
    return novos.length;
  }

  return { situacao, doMes, totais, adicionar, atualizar, remover, alternarPago, marcarPagos, gerarRecorrentes };
})();
