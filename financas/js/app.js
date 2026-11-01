/* Casca do aplicativo: navegação, cabeçalho, ações, formulários e importação. */
(() => {
  const U = FC.util;
  const A = FC.agentes;
  const O = FC.orquestrador;
  const T = FC.telas;
  const st = () => FC.store.estado;

  const ABAS = [
    { id: 'visao', nome: 'Visão geral', grupo: 'Dia a dia', sub: 'resumo do mês', ic: '<path d="M3 13h4v8H3zM10 3h4v18h-4zM17 9h4v12h-4z"/>' },
    { id: 'lancamentos', nome: 'Lançamentos', grupo: 'Dia a dia', sub: 'tudo que entrou e saiu', ic: '<path d="M4 6h16M4 12h16M4 18h10"/>' },
    { id: 'pagar', nome: 'Contas a pagar', grupo: 'Dia a dia', sub: 'vencimentos e pagamentos', ic: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>' },
    { id: 'importar', nome: 'Importar recibos', grupo: 'Dia a dia', sub: 'PDF, foto, boleto, extrato', ic: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>' },
    { id: 'orcamento', nome: 'Orçamento e reservas', grupo: 'Planejamento', sub: 'divisão da renda e limites', ic: '<circle cx="12" cy="12" r="9"/><path d="M12 3v9l6 6"/>' },
    { id: 'casal', nome: 'Conta do casal', grupo: 'Planejamento', sub: 'divisão e acerto entre vocês', ic: '<circle cx="9" cy="8" r="3.5"/><circle cx="16" cy="9" r="3"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M15 14.6c2.8.1 5 1.9 6.5 5.4"/>' },
    { id: 'metas', nome: 'Metas', grupo: 'Planejamento', sub: 'reserva de emergência e objetivos', ic: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>' },
    { id: 'relatorios', nome: 'Relatórios', grupo: 'Planejamento', sub: 'evolução e observações', ic: '<path d="M4 19l5-6 4 3 7-9"/><path d="M4 4v16h16"/>' },
    { id: 'categorias', nome: 'Categorias', grupo: 'Sistema', sub: 'grupos, limites e regras', ic: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>' },
    { id: 'agentes', nome: 'Agentes', grupo: 'Sistema', sub: 'quem faz o quê, e o diário', ic: '<rect x="5" y="7" width="14" height="12" rx="3"/><path d="M12 3v4M9 13h.01M15 13h.01"/>' },
    { id: 'ajustes', nome: 'Ajustes', grupo: 'Sistema', sub: 'pessoas, IA, backup', ic: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>' },
  ];

  const ui = {
    aba: (location.hash || '#visao').slice(1),
    ym: U.mesDe(U.hoje()),
    conta: 'todas',
    filtros: { tipo: 'todos', categoriaId: 'todas', situacao: 'todas', busca: '' },
    rascunhos: [],
    impConta: 'casal',
    processando: false,
    filtroAgente: 'todos',
  };
  if (!ABAS.some((a) => a.id === ui.aba)) ui.aba = 'visao';

  /* ---------- casca ---------- */
  function montarNav() {
    const atrasadas = st().lancamentos.filter((l) => l.tipo === 'despesa' && l.status !== 'pago' && l.vencimento < U.hoje()).length;
    let grupo = '';
    document.getElementById('nav').innerHTML = ABAS.map((a) => {
      const g = a.grupo !== grupo ? `<div class="nav-grupo">${a.grupo}</div>` : '';
      grupo = a.grupo;
      return `${g}<a href="#${a.id}" class="${ui.aba === a.id ? 'ativo' : ''}"><svg viewBox="0 0 24 24">${a.ic}</svg>${a.nome}${a.id === 'pagar' && atrasadas ? `<span class="contador">${atrasadas}</span>` : ''}</a>`;
    }).join('');
  }

  function montarTopo() {
    const aba = ABAS.find((a) => a.id === ui.aba);
    const comMes = ['visao', 'lancamentos', 'pagar', 'orcamento', 'casal', 'relatorios'].includes(ui.aba);
    const comConta = ['visao', 'lancamentos', 'pagar', 'relatorios'].includes(ui.aba);
    const p = st().config.pessoas;
    document.getElementById('topo').innerHTML = `
      <button class="btn btn-l menu-btn" data-acao="menu" aria-label="Menu">☰</button>
      <h2>${aba.nome}<small>${aba.sub}</small></h2>
      ${comConta ? `<div class="segmentado" role="group" aria-label="Conta">${[['todas', 'Tudo'], ['casal', 'Conjunta'], ['a', p.a], ['b', p.b]].map(([v, n]) => `<button data-acao="conta" data-conta="${v}" class="${ui.conta === v ? 'ativo' : ''}">${U.esc(n)}</button>`).join('')}</div>` : ''}
      ${comMes ? `<div class="seletor-mes"><button data-acao="mes" data-d="-1" aria-label="Mês anterior">‹</button><span>${U.mesLabel(ui.ym)}</span><button data-acao="mes" data-d="1" aria-label="Próximo mês">›</button></div>` : ''}
      <div class="linha-acoes"><button class="btn btn-p" data-acao="novo">+ Novo lançamento</button></div>`;
  }

  let telaAtual = null;
  function render() {
    montarNav();
    montarTopo();
    const tela = T[ui.aba](ui);
    telaAtual = tela;
    const c = document.getElementById('conteudo');
    c.innerHTML = tela.html;
    if (tela.depois) tela.depois();
    if (ui.aba === 'importar') ligarImportacao();
    if (ui.aba === 'orcamento') ligarAlocacao();
    document.title = `${ABAS.find((a) => a.id === ui.aba).nome} · Caderneta`;
  }

  let rTimer;
  O.on('mudou', () => { clearTimeout(rTimer); rTimer = setTimeout(render, 30); });
  O.on('agente-status', ({ agenteId, status }) => {
    const card = document.querySelector(`.agente[data-agente="${agenteId}"]`);
    if (card) { card.className = `agente ${status}`; card.querySelector('.estado').textContent = status; }
  });
  window.addEventListener('hashchange', () => { ui.aba = location.hash.slice(1) || 'visao'; if (!ABAS.some((a) => a.id === ui.aba)) ui.aba = 'visao'; document.querySelector('.app').classList.remove('menu-aberto'); render(); window.scrollTo(0, 0); });
  let wTimer;
  window.addEventListener('resize', () => { clearTimeout(wTimer); wTimer = setTimeout(() => telaAtual && telaAtual.depois && telaAtual.depois(), 150); });

  /* ---------- avisos ---------- */
  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('mostra');
    clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('mostra'), 2600);
  }

  /* ---------- modal genérico ---------- */
  function modal(titulo, corpo, botoes) {
    const fundo = document.createElement('div');
    fundo.className = 'fundo-modal';
    fundo.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${U.esc(titulo)}"><header><h3>${U.esc(titulo)}</h3><button class="btn btn-l" data-fechar aria-label="Fechar">✕</button></header><div class="corpo">${corpo}</div><footer>${botoes}</footer></div>`;
    const fechar = () => fundo.remove();
    fundo.addEventListener('click', (ev) => { if (ev.target === fundo || ev.target.closest('[data-fechar]')) fechar(); });
    fundo.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') fechar(); });
    document.body.appendChild(fundo);
    const primeiro = fundo.querySelector('input, select, textarea');
    if (primeiro) primeiro.focus();
    return { el: fundo, fechar };
  }

  /* ---------- formulário de lançamento ---------- */
  function formLancamento(l) {
    const novo = !l;
    l = l || { tipo: 'despesa', data: ui.ym === U.mesDe(U.hoje()) ? U.hoje() : `${ui.ym}-01`, conta: ui.conta === 'todas' ? 'casal' : ui.conta, pagoPor: 'a', status: 'pendente', forma: 'pix', categoriaId: 'mercado', valor: '' };
    const p = st().config.pessoas;
    const m = modal(novo ? 'Novo lançamento' : 'Editar lançamento', `
      <div class="tipo-toggle"><label><input type="radio" name="tipo" value="despesa" ${l.tipo === 'despesa' ? 'checked' : ''}><span>Despesa</span></label><label><input type="radio" name="tipo" value="receita" ${l.tipo === 'receita' ? 'checked' : ''}><span>Receita</span></label></div>
      <div class="grade-campos">
        <label class="campo inteiro">Descrição<input name="descricao" value="${U.esc(l.descricao || '')}" placeholder="Ex.: Conta de luz" required></label>
        <label class="campo">Valor (R$)<input name="valor" inputmode="decimal" value="${l.valor !== '' ? String(l.valor).replace('.', ',') : ''}" placeholder="0,00" required></label>
        <label class="campo">Categoria<select name="categoriaId">${T.opcoesCategorias(l.categoriaId, l.tipo)}</select></label>
        <label class="campo">Data (competência)<input type="date" name="data" value="${l.data}"></label>
        <label class="campo">Vencimento<input type="date" name="vencimento" value="${l.vencimento || l.data}"></label>
        <label class="campo">Conta<select name="conta">${T.opcoesContas(l.conta)}</select></label>
        <label class="campo" id="campo-pagopor">Quem paga<select name="pagoPor"><option value="a" ${l.pagoPor === 'a' ? 'selected' : ''}>${U.esc(p.a)}</option><option value="b" ${l.pagoPor === 'b' ? 'selected' : ''}>${U.esc(p.b)}</option></select></label>
        <label class="campo">Status<select name="status"><option value="pendente" ${l.status !== 'pago' ? 'selected' : ''}>Em aberto</option><option value="pago" ${l.status === 'pago' ? 'selected' : ''}>Pago / recebido</option></select></label>
        <label class="campo">Forma<select name="forma">${[['pix', 'Pix'], ['cartao', 'Cartão de crédito'], ['debito', 'Débito'], ['boleto', 'Boleto'], ['dinheiro', 'Dinheiro'], ['outro', 'Outro']].map(([v, n]) => `<option value="${v}" ${l.forma === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        ${novo ? '<label class="campo">Parcelas<input name="parcelas" type="number" min="1" max="72" value="1"></label>' : ''}
        <label class="campo ${novo ? '' : 'inteiro'}">&nbsp;<span class="check"><input type="checkbox" name="recorrente" ${l.recorrente ? 'checked' : ''}> Repete todo mês</span></label>
        <label class="campo inteiro">Notas<textarea name="notas" rows="2">${U.esc(l.notas || '')}</textarea></label>
      </div>
      ${!novo && l.texto ? '' : ''}`,
      `${novo ? '' : '<button class="btn btn-perigo esq" data-del>Excluir</button>'}<button class="btn" data-fechar>Cancelar</button><button class="btn btn-p" data-ok>${novo ? 'Lançar' : 'Salvar'}</button>`);
    const f = m.el;
    const campo = (n) => f.querySelector(`[name="${n}"]`);
    const ajustar = () => {
      const tipo = f.querySelector('[name="tipo"]:checked').value;
      f.querySelector('#campo-pagopor').style.display = campo('conta').value === 'casal' ? '' : 'none';
      const atual = campo('categoriaId').value;
      const ehReceita = FC.store.categoria(atual).grupo === 'receita';
      if ((tipo === 'receita') !== ehReceita) campo('categoriaId').innerHTML = T.opcoesCategorias(tipo === 'receita' ? 'salario' : 'outros', tipo);
    };
    f.querySelectorAll('[name="tipo"], [name="conta"]').forEach((x) => x.addEventListener('change', ajustar));
    ajustar();
    // sugestão automática de categoria enquanto digita a descrição
    campo('descricao').addEventListener('change', () => {
      if (!novo) return;
      const tipo = f.querySelector('[name="tipo"]:checked').value;
      const c = A.classificador.classificar({ descricao: campo('descricao').value, tipo });
      if (c.confianca >= 0.55) campo('categoriaId').value = c.categoriaId;
    });
    f.querySelector('[data-ok]').addEventListener('click', () => {
      const valor = U.parseValor(campo('valor').value);
      if (!campo('descricao').value.trim() || !valor) { toast('Preencha descrição e valor.'); return; }
      const d = {
        tipo: f.querySelector('[name="tipo"]:checked').value,
        descricao: campo('descricao').value.trim(), valor,
        categoriaId: campo('categoriaId').value, data: campo('data').value, vencimento: campo('vencimento').value || campo('data').value,
        conta: campo('conta').value, pagoPor: campo('pagoPor').value, status: campo('status').value, forma: campo('forma').value,
        recorrente: campo('recorrente').checked, notas: campo('notas').value,
      };
      if (novo) {
        const n = +(campo('parcelas').value || 1);
        if (n > 1) d.parcela = { n: 1, total: n };
        A.tesoureiro.adicionar(d);
        toast(n > 1 ? `Lançado em ${n} parcelas.` : 'Lançamento salvo.');
      } else {
        A.tesoureiro.atualizar(l.id, d);
        toast('Alterações salvas.');
      }
      m.fechar();
    });
    const del = f.querySelector('[data-del]');
    if (del) del.addEventListener('click', () => { if (confirm(`Excluir "${l.descricao}"?`)) { A.tesoureiro.remover(l.id); m.fechar(); toast('Excluído.'); } });
  }

  function formMeta(meta) {
    const novo = !meta;
    meta = meta || { nome: '', alvo: '', guardado: 0, prazo: '' };
    const m = modal(novo ? 'Nova meta' : 'Editar meta', `
      <div class="grade-campos">
        <label class="campo inteiro">Nome<input name="nome" value="${U.esc(meta.nome)}" placeholder="Ex.: Viagem de aniversário"></label>
        <label class="campo">Valor alvo (R$)<input name="alvo" inputmode="decimal" value="${meta.alvo}"></label>
        <label class="campo">Já guardado (R$)<input name="guardado" inputmode="decimal" value="${meta.guardado}"></label>
        <label class="campo">Prazo<input type="date" name="prazo" value="${meta.prazo || ''}"></label>
      </div>`, '<button class="btn" data-fechar>Cancelar</button><button class="btn btn-p" data-ok>Salvar</button>');
    m.el.querySelector('[data-ok]').addEventListener('click', () => {
      const g = (n) => m.el.querySelector(`[name="${n}"]`).value;
      if (!g('nome').trim() || !U.parseValor(g('alvo'))) { toast('Dê um nome e um valor alvo.'); return; }
      const d = { nome: g('nome').trim(), alvo: U.parseValor(g('alvo')), guardado: U.parseValor(g('guardado')), prazo: g('prazo') };
      if (novo) st().metas.push({ id: U.uid(), ...d }); else Object.assign(st().metas.find((x) => x.id === meta.id), d);
      FC.store.salvar();
      O.log('planejador', `${novo ? 'Criei' : 'Atualizei'} a meta "${d.nome}" (${U.moeda(d.alvo)}).`);
      m.fechar();
    });
  }

  function formAporte(id, retirada) {
    const meta = st().metas.find((x) => x.id === id);
    const m = modal(`${retirada ? 'Retirada de' : 'Aporte em'} ${meta.nome}`, `
      <div class="grade-campos">
        <label class="campo">Valor (R$)<input name="valor" inputmode="decimal" placeholder="0,00"></label>
        <label class="campo">Saiu da conta<select name="conta">${T.opcoesContas('casal')}</select></label>
        ${retirada ? '' : '<label class="campo inteiro"><span class="check"><input type="checkbox" name="lancar" checked> Registrar também como lançamento (categoria Investimentos)</span></label>'}
      </div>`, '<button class="btn" data-fechar>Cancelar</button><button class="btn btn-p" data-ok>Confirmar</button>');
    m.el.querySelector('[data-ok]').addEventListener('click', () => {
      const v = U.parseValor(m.el.querySelector('[name="valor"]').value);
      if (!v) return;
      const lancar = !retirada && m.el.querySelector('[name="lancar"]').checked;
      A.planejador.aportar(id, retirada ? -v : v, lancar, m.el.querySelector('[name="conta"]').value);
      m.fechar(); toast(retirada ? 'Retirada registrada.' : 'Aporte registrado.');
    });
  }

  /* ---------- importação ---------- */
  function ligarImportacao() {
    const zona = document.getElementById('soltar');
    const input = document.getElementById('arquivos');
    const conta = document.getElementById('imp-conta');
    conta.addEventListener('change', () => { ui.impConta = conta.value; });
    input.addEventListener('change', () => processar([...input.files]));
    ['dragenter', 'dragover'].forEach((ev) => zona.addEventListener(ev, (e) => { e.preventDefault(); zona.classList.add('sobre'); }));
    ['dragleave', 'drop'].forEach((ev) => zona.addEventListener(ev, (e) => { e.preventDefault(); zona.classList.remove('sobre'); }));
    zona.addEventListener('drop', (e) => processar([...e.dataTransfer.files]));
  }

  O.on('pipeline', ({ arquivo, etapa }) => {
    const pipe = document.getElementById('pipeline');
    if (!pipe) return;
    document.getElementById('pipe-arq').textContent = etapa === 'pronto' ? `${arquivo}: pronto` : etapa === 'erro' ? `${arquivo}: erro` : arquivo;
    const ordem = ['leitor', 'ia', 'extrator', 'classificador', 'sentinela'];
    const i = ordem.indexOf(etapa);
    pipe.querySelectorAll('.etapa').forEach((el) => {
      const j = ordem.indexOf(el.dataset.etapa);
      el.classList.toggle('ativa', el.dataset.etapa === etapa);
      el.classList.toggle('feita', etapa === 'pronto' || (i >= 0 && j < i));
    });
  });

  async function processar(files) {
    if (!files.length) return;
    ui.processando = true;
    const usarIA = !!(document.getElementById('imp-ia') || {}).checked;
    const conta = ui.impConta;
    for (const f of files) {
      const r = await O.processarArquivo(f, { conta, usarIA });
      ui.rascunhos.push(...r);
    }
    ui.processando = false;
    render();
    toast(`${ui.rascunhos.length} item(ns) prontos para revisão.`);
  }

  function lerRevisao() {
    return [...document.querySelectorAll('tr[data-i]')].map((tr) => {
      const r = ui.rascunhos[+tr.dataset.i];
      return {
        incluir: tr.querySelector('.r-incluir').checked,
        r: Object.assign({}, r, {
          descricao: tr.querySelector('.r-desc').value.trim() || r.descricao,
          categoriaId: tr.querySelector('.r-cat').value,
          conta: tr.querySelector('.r-conta').value,
          vencimento: tr.querySelector('.r-venc').value || r.vencimento,
          status: tr.querySelector('.r-status').value,
          valor: U.parseValor(tr.querySelector('.r-valor').value),
          tipo: tr.querySelector('.r-tipo').value,
        }),
        original: r,
      };
    });
  }

  /* ---------- orçamento: soma ao vivo ---------- */
  function ligarAlocacao() {
    const ins = document.querySelectorAll('[data-balde]');
    const atualizar = () => {
      const s = [...ins].reduce((a, i) => a + Number(i.value || 0), 0);
      const el = document.getElementById('soma-aloc');
      el.textContent = `soma ${s}%`;
      el.style.background = s === 100 ? '' : 'var(--critico-bg)';
      el.style.color = s === 100 ? '' : 'var(--critico)';
    };
    ins.forEach((i) => i.addEventListener('input', atualizar));
    atualizar();
  }

  /* ---------- ações (delegação de eventos) ---------- */
  const acoes = {
    menu: () => document.querySelector('.app').classList.toggle('menu-aberto'),
    ir: (el) => { location.hash = el.dataset.aba; },
    mes: (el) => { ui.ym = U.somaMes(ui.ym, +el.dataset.d); render(); },
    conta: (el) => { ui.conta = el.dataset.conta; render(); },
    novo: () => formLancamento(),
    editar: (el) => formLancamento(st().lancamentos.find((l) => l.id === el.dataset.id)),
    'alternar-pago': (el) => A.tesoureiro.alternarPago(el.dataset.id),
    pagar: (el) => { A.tesoureiro.marcarPagos([el.dataset.id]); toast('Conta marcada como paga.'); },
    'sel-todos': (el) => { document.querySelectorAll('.sel').forEach((c) => { c.checked = el.checked; }); selecao(); },
    'pagar-selecionados': () => { A.tesoureiro.marcarPagos(selecionados()); toast('Contas marcadas como pagas.'); },
    'excluir-selecionados': () => { const ids = selecionados(); if (confirm(`Excluir ${ids.length} lançamento(s)?`)) ids.forEach((id) => A.tesoureiro.remover(id)); },
    'exportar-csv': () => A.arquivista.exportarCSV(telaAtual.lista || [], `lancamentos-${ui.ym}.csv`),
    'exportar-tudo': () => A.arquivista.exportarCSV(st().lancamentos.slice().sort((a, b) => (a.data < b.data ? -1 : 1)), `lancamentos-completo-${U.hoje()}.csv`),
    'exportar-ano': () => {
      const ini = U.somaMes(ui.ym, -11);
      A.arquivista.exportarCSV(st().lancamentos.filter((l) => U.mesDe(l.data) >= ini && U.mesDe(l.data) <= ui.ym).sort((a, b) => (a.data < b.data ? -1 : 1)), `lancamentos-${ini}-a-${ui.ym}.csv`);
    },
    'gerar-recorrentes': () => { const n = A.tesoureiro.gerarRecorrentes(ui.ym); toast(n ? `${n} conta(s) recorrente(s) criadas.` : 'Nenhuma recorrente nova para este mês.'); },
    varredura: () => { const a = A.sentinela.varredura(ui.ym); toast(`${a.length} alerta(s) encontrados.`); render(); },
    'limpar-diario': () => { st().diario = []; FC.store.salvar(); },
    'importar-texto': async () => {
      const txt = document.getElementById('imp-texto').value.trim();
      if (!txt) return;
      const arq = new File([txt], 'texto-colado.txt', { type: 'text/plain' });
      await processar([arq]);
    },
    'modelo-csv': () => A.arquivista.modeloCSV(),
    'descartar-rascunhos': () => { ui.rascunhos = []; render(); },
    'lancar-rascunhos': () => {
      const itens = lerRevisao();
      let n = 0;
      itens.forEach(({ incluir, r, original }) => {
        if (!incluir || !r.valor) return;
        if (r.categoriaId !== original.categoriaId) A.classificador.aprender(r.descricao, r.categoriaId);
        A.tesoureiro.adicionar(r, { silencioso: true });
        n++;
      });
      ui.rascunhos = [];
      O.log('tesoureiro', `Lancei ${n} item(ns) vindos da importação.`);
      toast(`${n} lançamento(s) adicionados.`);
    },
    'salvar-alocacao': () => {
      const novo = {}; document.querySelectorAll('[data-balde]').forEach((i) => { novo[i.dataset.balde] = i.value; });
      const erro = A.planejador.salvarAlocacao(novo);
      toast(erro || 'Divisão da renda salva.');
    },
    'salvar-orcamentos': () => {
      document.querySelectorAll('[data-orc]').forEach((i) => { FC.store.categoria(i.dataset.orc).orcamento = Number(i.value) || 0; });
      FC.store.salvar(); O.log('planejador', 'Orçamentos por categoria atualizados.'); toast('Orçamentos salvos.');
    },
    'modo-divisao': (el) => { st().config.divisao.modo = el.dataset.modo; FC.store.salvar(); O.log('divisor', `Modo de divisão: ${el.textContent}.`); },
    'salvar-pct': () => { st().config.divisao.pctA = Math.min(100, Math.max(0, Number(document.getElementById('pct-a').value))); FC.store.salvar(); },
    'registrar-acerto': () => { A.divisor.registrarAcerto(ui.ym); toast('Acerto registrado.'); },
    aportar: (el) => formAporte(el.dataset.id, false),
    retirar: (el) => formAporte(el.dataset.id, true),
    'nova-meta': () => formMeta(),
    'editar-meta': (el) => formMeta(st().metas.find((m) => m.id === el.dataset.id)),
    'excluir-meta': (el) => { const m = st().metas.find((x) => x.id === el.dataset.id); if (confirm(`Excluir a meta "${m.nome}"?`)) { st().metas = st().metas.filter((x) => x !== m); FC.store.salvar(); } },
    'baixar-resumo': () => U.baixar(`resumo-${ui.ym}.txt`, A.analista.relatorioTexto(ui.ym)),
    imprimir: () => window.print(),
    'salvar-categorias': () => {
      document.querySelectorAll('tr[data-cat]').forEach((tr) => {
        const c = FC.store.categoria(tr.dataset.cat);
        c.nome = tr.querySelector('.c-nome').value.trim() || c.nome;
        c.grupo = tr.querySelector('.c-grupo').value;
        c.orcamento = Number(tr.querySelector('.c-orc').value) || 0;
      });
      FC.store.salvar(); toast('Categorias salvas.');
    },
    'criar-categoria': () => {
      const nome = document.getElementById('nova-cat-nome').value.trim();
      if (!nome) return;
      let id = U.normalizar(nome).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || U.uid();
      if (st().categorias.some((c) => c.id === id)) id += '-' + U.uid().slice(-3);
      st().categorias.push({ id, nome, grupo: document.getElementById('nova-cat-grupo').value, orcamento: Number(document.getElementById('nova-cat-orc').value) || 0 });
      FC.store.salvar(); O.log('classificador', `Nova categoria "${nome}" — passo a reconhecê-la pelo nome.`); toast('Categoria criada.');
    },
    'excluir-categoria': (el) => {
      const c = FC.store.categoria(el.dataset.id);
      const usos = st().lancamentos.filter((l) => l.categoriaId === c.id).length;
      if (!confirm(`Excluir "${c.nome}"?${usos ? ` Os ${usos} lançamento(s) dela vão para "Outros".` : ''}`)) return;
      st().lancamentos.forEach((l) => { if (l.categoriaId === c.id) l.categoriaId = c.grupo === 'receita' ? 'extra' : 'outros'; });
      st().categorias = st().categorias.filter((x) => x.id !== c.id);
      st().regras = st().regras.filter((g) => g.categoriaId !== c.id);
      FC.store.salvar();
    },
    'esquecer-regra': (el) => { st().regras.splice(+el.dataset.i, 1); FC.store.salvar(); },
    'salvar-pessoas': () => {
      st().config.pessoas = { a: document.getElementById('aj-a').value.trim() || 'Pessoa 1', b: document.getElementById('aj-b').value.trim() || 'Pessoa 2' };
      FC.store.salvar(); toast('Nomes salvos.');
    },
    'salvar-ia': () => {
      Object.assign(st().config.ia, { apiKey: document.getElementById('aj-chave').value.trim(), modelo: document.getElementById('aj-modelo').value, sempre: document.getElementById('aj-sempre').checked });
      FC.store.salvar(); O.log('ia', st().config.ia.apiKey ? `Ligado com o modelo ${st().config.ia.modelo}.` : 'Desligado (sem chave).'); toast('Configuração da IA salva.');
    },
    'testar-ia': async (el) => {
      acoes['salvar-ia']();
      el.disabled = true; el.textContent = 'Testando…';
      try { await A.ia.testar(); toast('Conexão OK — o Analista IA está pronto.'); } catch (err) { O.log('ia', `Falha no teste: ${err.message}`, 'erro'); toast('Falhou: ' + err.message); }
      el.disabled = false; el.textContent = 'Testar conexão';
    },
    backup: () => A.arquivista.backup(),
    'carregar-exemplo': () => { if (confirm('Substituir tudo pelos dados de exemplo?')) { FC.store.resetarDemo(); toast('Dados de exemplo carregados.'); } },
    zerar: () => {
      if (!confirm('Apagar todos os lançamentos, metas e o diário? Categorias, orçamentos e ajustes continuam. Faça um backup antes se quiser.')) return;
      const s = st();
      s.lancamentos = []; s.diario = []; s.acertos = []; s.demo = false;
      s.metas = [{ id: 'reserva', nome: 'Reserva de emergência', alvo: 0, guardado: 0, prazo: '', especial: true }];
      FC.store.salvar(); O.log('arquivista', 'Começamos do zero. Bom recomeço!');
    },
  };

  const selecionados = () => [...document.querySelectorAll('.sel:checked')].map((c) => c.value);
  function selecao() {
    const n = selecionados().length;
    document.querySelectorAll('[data-acao="pagar-selecionados"], [data-acao="excluir-selecionados"]').forEach((b) => { b.disabled = !n; });
  }

  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-acao]');
    if (!el || el.tagName === 'SELECT') return;
    const fn = acoes[el.dataset.acao];
    if (!fn) return;
    if (el.tagName === 'A') ev.preventDefault();
    fn(el, ev);
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && ev.target.matches('.alerta[data-acao]')) acoes.ir(ev.target);
    if (ev.key === 'n' && !ev.target.closest('input, textarea, select') && !document.querySelector('.fundo-modal')) { ev.preventDefault(); formLancamento(); }
  });
  document.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.classList.contains('sel')) return selecao();
    if (t.dataset.filtro) { ui.filtros[t.dataset.filtro] = t.value; render(); return; }
    if (t.id === 'restaurar' && t.files[0]) {
      A.arquivista.restaurar(t.files[0]).then(() => toast('Backup restaurado.')).catch((err) => toast('Não deu: ' + err.message));
      return;
    }
    if (t.id === 'reserva-meses') { st().config.reservaMeses = Math.max(1, Number(t.value) || 6); FC.store.salvar(); return; }
    const a = t.dataset.acaoChange;
    if (a === 'pago-por') { const l = st().lancamentos.find((x) => x.id === t.dataset.id); l.pagoPor = t.value; FC.store.salvar(); }
    if (a === 'filtro-agente') { ui.filtroAgente = t.value; render(); }
    if (a === 'ocr') { st().config.ocr = t.checked; FC.store.salvar(); }
  });
  let bTimer;
  document.addEventListener('input', (ev) => {
    if (ev.target.dataset.filtro === 'busca') {
      clearTimeout(bTimer);
      bTimer = setTimeout(() => {
        ui.filtros.busca = ev.target.value; render();
        const b = document.querySelector('[data-filtro="busca"]');
        if (b) { b.focus(); b.setSelectionRange(b.value.length, b.value.length); }
      }, 250);
    }
  });

  /* ---------- partida ---------- */
  const mesAtual = U.mesDe(U.hoje());
  const geradas = A.tesoureiro.gerarRecorrentes(mesAtual);
  if (!st().diario.length) {
    O.log('tesoureiro', `Bom dia! ${st().lancamentos.length} lançamentos carregados${st().demo ? ' (dados de exemplo)' : ''}.`);
  }
  A.sentinela.varredura(mesAtual);
  if (geradas) O.log('tesoureiro', `Contas fixas de ${U.mesLabel(mesAtual)} já estão na lista de contas a pagar.`);
  render();
})();
