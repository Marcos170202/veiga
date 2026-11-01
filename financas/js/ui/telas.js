/* Telas (abas). Cada função devolve HTML e, se precisar, um "depois" para montar gráficos/eventos. */
FC.telas = (() => {
  const U = FC.util;
  const G = FC.graficos;
  const A = FC.agentes;
  const st = () => FC.store.estado;
  const e = U.esc;
  const cat = (id) => FC.store.categoria(id);
  const pessoas = () => st().config.pessoas;

  const pill = (l) => {
    if (l.tipo === 'receita') return `<button class="st st-${l.status === 'pago' ? 'receita' : 'pendente'}" data-acao="alternar-pago" data-id="${l.id}" title="Clique para alternar">${l.status === 'pago' ? 'recebido' : 'a receber'}</button>`;
    const s = A.tesoureiro.situacao(l);
    const rot = { pago: 'pago', pendente: 'a pagar', hoje: 'vence hoje', atrasado: 'atrasado' }[s];
    return `<button class="st st-${s}" data-acao="alternar-pago" data-id="${l.id}" title="Clique para alternar">${rot}</button>`;
  };
  const etqConta = (c) => `<span class="etq etq-${c}">${e(FC.store.nomeConta(c))}</span>`;
  const opcoesCategorias = (sel, tipo) => st().categorias
    .filter((c) => !tipo || (tipo === 'receita') === (c.grupo === 'receita'))
    .map((c) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${e(c.nome)}</option>`).join('');
  const opcoesContas = (sel, comTodas) => (comTodas ? [['todas', 'Todas as contas']] : []).concat([['casal', 'Conjunta'], ['a', pessoas().a], ['b', pessoas().b]])
    .map(([v, n]) => `<option value="${v}" ${v === sel ? 'selected' : ''}>${e(n)}</option>`).join('');
  const contaFiltro = (c) => (c === 'todas' ? undefined : c);

  /* =============== VISÃO GERAL =============== */
  function visao(ctx) {
    const conta = contaFiltro(ctx.conta);
    const t = A.tesoureiro.totais(ctx.ym, conta);
    const ant = A.tesoureiro.totais(U.somaMes(ctx.ym, -1), conta);
    const varDesp = ant.despesas ? (t.despesas - ant.despesas) / ant.despesas * 100 : 0;
    const abertos = A.tesoureiro.doMes(ctx.ym, { conta, tipo: 'despesa', situacao: 'aberto' });
    const alertas = A.sentinela.alertas(ctx.ym);
    const h = U.hoje();
    const proximos = st().lancamentos.filter((l) => l.tipo === 'despesa' && l.status !== 'pago' && (!conta || l.conta === conta))
      .sort((a, b) => (a.vencimento < b.vencimento ? -1 : 1)).slice(0, 6);
    const ac = A.divisor.acerto(ctx.ym);
    const res = A.planejador.reserva(ctx.ym);
    const metas = A.planejador.metas().filter((m) => !m.especial).slice(0, 3);

    const vazio = !st().lancamentos.length;
    const html = `
      ${vazio ? `<section class="cartao boas-vindas">
        <div><h3>Comece pelo extrato do mês</h3>
        <p>Ainda não há lançamentos${FC.nuvem.estado === 'conectando' ? ' (carregando da nuvem…)' : ''}. Envie o extrato do banco em PDF, CSV ou OFX, uma foto de recibo ou um boleto: os agentes separam cada movimentação, sugerem a categoria e você confere antes de lançar.</p></div>
        <div class="linha-acoes"><button class="btn btn-p" data-acao="ir" data-aba="importar">Importar extrato ou recibo</button><button class="btn" data-acao="novo">Lançar à mão</button></div>
      </section>` : ''}
      <section class="kpis">
        <div class="kpi"><div class="rot">Receitas do mês</div><div class="val">${U.moeda(t.receitas)}</div><div class="det">${ant.receitas ? `${t.receitas >= ant.receitas ? '+' : ''}${U.moeda(t.receitas - ant.receitas)} vs. mês anterior` : '&nbsp;'}</div></div>
        <div class="kpi"><div class="rot">Despesas do mês</div><div class="val">${U.moeda(t.despesas)}</div><div class="det">${ant.despesas ? `<b class="${varDesp > 0 ? 'sobe' : 'desce'}">${varDesp > 0 ? '▲' : '▼'} ${Math.abs(varDesp).toFixed(0)}%</b> vs. ${U.mesCurto(U.somaMes(ctx.ym, -1))}` : '&nbsp;'}</div></div>
        <div class="kpi"><div class="rot">Saldo do mês</div><div class="val ${t.saldo < 0 ? 'neg' : ''}">${U.moeda(t.saldo)}</div><div class="det">${t.receitas ? `${Math.round(t.saldo / t.receitas * 100)}% da renda` : '&nbsp;'}</div></div>
        <div class="kpi"><div class="rot">Ainda a pagar</div><div class="val">${U.moeda(t.aPagar)}</div><div class="det">${abertos.length} conta(s)${t.atrasado ? ` · <b class="neg">${U.moeda(t.atrasado)} atrasado</b>` : ''}</div></div>
      </section>

      <div class="grade-21">
        <section class="cartao"><header><h3>Receitas e despesas</h3><span class="sub">últimos 12 meses</span></header><div id="g-linhas"></div></section>
        <section class="cartao"><header><h3>Avisos da Sentinela</h3><span class="sub">${alertas.length || 'nenhum'}</span></header>
          ${alertas.length ? `<div class="alertas">${alertas.slice(0, 5).map((a) => `
            <div class="alerta alerta-${a.nivel}" data-acao="ir" data-aba="${a.aba}" role="button" tabindex="0">
              <span class="ic">${a.nivel === 'info' ? 'i' : '!'}</span>
              <div><b>${e(a.titulo)}</b><span>${e(a.texto)}</span></div>
              ${a.total ? `<span class="tot">${U.moeda(a.total)}</span>` : '<span></span>'}
            </div>`).join('')}</div>` : '<p class="tudo-certo">Nada fora do lugar. Contas em dia e orçamento sob controle.</p>'}
        </section>
      </div>

      <div class="grade-2">
        <section class="cartao"><header><h3>Para onde foi o dinheiro</h3><span class="sub">traço = orçamento</span></header><div id="g-cat"></div></section>
        <section class="cartao"><header><h3>Divisão da renda</h3><span class="sub">real × planejado</span></header><div id="g-rosca"></div></section>
      </div>

      <div class="grade-3">
        <section class="cartao"><header><h3>Próximos vencimentos</h3><button class="btn btn-l" data-acao="ir" data-aba="pagar">ver todos</button></header>
          ${proximos.length ? `<div class="lista">${proximos.map((l) => itemConta(l, h)).join('')}</div>` : '<p class="vazio">Nenhuma conta em aberto.</p>'}
        </section>
        <section class="cartao"><header><h3>Conta conjunta</h3><button class="btn btn-l" data-acao="ir" data-aba="casal">detalhes</button></header>
          <p style="margin:0 0 12px;font-size:15px">${e(A.divisor.frase(ac))}</p>
          <div class="pessoa" style="padding:12px 14px">
            <div class="linha"><span>Gasto conjunto pago</span><b>${U.moeda(ac.total)}</b></div>
            <div class="linha"><span>${e(pessoas().a)} pagou</span><b>${U.moeda(ac.pagoA)}</b></div>
            <div class="linha"><span>${e(pessoas().b)} pagou</span><b>${U.moeda(ac.pagoB)}</b></div>
            <div class="linha"><span>Divisão</span><b>${Math.round(ac.pctA)}% / ${Math.round(ac.pctB)}%</b></div>
            ${ac.aberto ? `<div class="linha"><span>Em aberto</span><b>${U.moeda(ac.aberto)}</b></div>` : ''}
          </div>
        </section>
        <section class="cartao"><header><h3>Reserva e metas</h3><button class="btn btn-l" data-acao="ir" data-aba="metas">metas</button></header>
          <div style="display:flex;justify-content:space-between;font-size:13px"><span>Reserva de emergência</span><b>${U.moeda(res.guardado)}</b></div>
          ${G.progresso(res.pct, 'meta')}
          <p class="muted" style="font-size:12px;margin:5px 0 14px">Cobre ${res.meses.toFixed(1)} de ${st().config.reservaMeses} meses de custo essencial (alvo ${U.moeda(res.alvo)}).</p>
          ${metas.map((m) => `<div style="display:flex;justify-content:space-between;font-size:13px;margin-top:8px"><span>${e(m.nome)}</span><span class="muted">${Math.round(m.pct)}%</span></div>${G.progresso(m.pct, 'meta')}`).join('')}
        </section>
      </div>`;

    const depois = () => {
      G.linhas(document.getElementById('g-linhas'), A.analista.serie(ctx.ym, 12, conta), [
        { chave: 'receitas', nome: 'Receitas', cor: G.SERIES[0] },
        { chave: 'despesas', nome: 'Despesas', cor: G.SERIES[1] },
      ]);
      const orc = Object.fromEntries(st().categorias.map((c) => [c.id, c.orcamento]));
      G.barras(document.getElementById('g-cat'), A.analista.porCategoria(ctx.ym, conta).map((c) => ({ ...c, orcamento: conta ? 0 : orc[c.id] })), { max: 8 });
      const aloc = A.planejador.alocacao(ctx.ym, conta);
      const cores = [G.SERIES[0], G.SERIES[1], G.SERIES[2], G.SERIES[3], G.NEUTRO];
      G.rosca(document.getElementById('g-rosca'), aloc.map((b, i) => ({ nome: b.nome, valor: b.real, cor: cores[i], meta: b.pctPlano })),
        { valor: U.moedaCurta(t.receitas), rotulo: 'renda do mês' });
    };
    return { html, depois };
  }

  function itemConta(l, h) {
    const d = U.parseISO(l.vencimento);
    const dias = U.diasEntre(h, l.vencimento);
    const quando = dias < 0 ? `${-dias} dia(s) de atraso` : dias === 0 ? 'vence hoje' : dias === 1 ? 'vence amanhã' : `em ${dias} dias`;
    return `<div class="item">
      <div class="dia"><b>${d.getDate()}</b><span>${U.MESES_CURTOS[d.getMonth()]}</span></div>
      <div class="t">${e(l.descricao)}<small>${e(cat(l.categoriaId).nome)} · ${e(FC.store.nomeConta(l.conta))} · ${quando}</small></div>
      <div class="v">${U.moeda(l.valor)}</div>
      <button class="btn btn-pq" data-acao="pagar" data-id="${l.id}">Pagar</button>
    </div>`;
  }

  /* =============== LANÇAMENTOS =============== */
  function lancamentos(ctx) {
    const f = ctx.filtros;
    const lista = A.tesoureiro.doMes(ctx.ym, { conta: contaFiltro(ctx.conta), ...f });
    const rec = lista.filter((l) => l.tipo === 'receita').reduce((s, l) => s + l.valor, 0);
    const desp = lista.filter((l) => l.tipo === 'despesa').reduce((s, l) => s + l.valor, 0);
    const html = `
      <section class="cartao">
        <div class="filtros">
          <input type="search" placeholder="Buscar descrição, nota ou categoria" value="${e(f.busca || '')}" data-filtro="busca">
          <select data-filtro="tipo"><option value="todos">Receitas e despesas</option><option value="despesa" ${f.tipo === 'despesa' ? 'selected' : ''}>Só despesas</option><option value="receita" ${f.tipo === 'receita' ? 'selected' : ''}>Só receitas</option></select>
          <select data-filtro="categoriaId"><option value="todas">Todas as categorias</option>${opcoesCategorias(f.categoriaId)}</select>
          <select data-filtro="situacao">${[['todas', 'Qualquer status'], ['aberto', 'Em aberto'], ['pago', 'Pagos'], ['atrasado', 'Atrasados']].map(([v, n]) => `<option value="${v}" ${f.situacao === v ? 'selected' : ''}>${n}</option>`).join('')}</select>
          <span style="margin-left:auto" class="linha-acoes">
            <button class="btn" data-acao="pagar-selecionados" disabled>Marcar pagos</button>
            <button class="btn" data-acao="excluir-selecionados" disabled>Excluir</button>
            <button class="btn" data-acao="exportar-csv">Exportar CSV</button>
          </span>
        </div>
        <div class="tabela-envolve">
        <table class="tabela">
          <thead><tr><th style="width:28px"><input type="checkbox" class="check" data-acao="sel-todos" aria-label="Selecionar todos"></th><th>Data</th><th>Descrição</th><th>Conta</th><th>Vencimento</th><th>Status</th><th class="num">Valor</th><th></th></tr></thead>
          <tbody>
          ${lista.length ? lista.map((l) => `<tr>
            <td><input type="checkbox" class="sel" value="${l.id}" aria-label="Selecionar"></td>
            <td>${U.dataCurta(l.data)}</td>
            <td class="desc">${e(l.descricao)}${l.origem === 'ia' ? ' <span class="etq etq-ia">IA</span>' : ''}<small>${e(cat(l.categoriaId).nome)} · ${e(l.forma || '')}${l.recorrente ? ' · recorrente' : ''}${l.conta === 'casal' ? ` · pago por ${e(l.pagoPor === 'a' ? pessoas().a : pessoas().b)}` : ''}</small></td>
            <td>${etqConta(l.conta)}</td>
            <td>${l.tipo === 'despesa' ? U.dataCurta(l.vencimento) : '—'}</td>
            <td>${pill(l)}</td>
            <td class="num ${l.tipo === 'receita' ? 'receita-v' : ''}">${l.tipo === 'receita' ? '+' : ''}${U.moeda(l.valor)}</td>
            <td class="acoes"><button class="btn btn-l btn-pq" data-acao="editar" data-id="${l.id}">editar</button></td>
          </tr>`).join('') : `<tr><td colspan="8" class="vazio">Nenhum lançamento em ${U.mesLabel(ctx.ym)} com esses filtros.</td></tr>`}
          </tbody>
          <tfoot><tr><td></td><td colspan="5">${lista.length} lançamento(s) · receitas ${U.moeda(rec)} · despesas ${U.moeda(desp)}</td><td class="num">${U.moeda(rec - desp)}</td><td></td></tr></tfoot>
        </table>
        </div>
      </section>`;
    return { html, lista };
  }

  /* =============== CONTAS A PAGAR =============== */
  function pagar(ctx) {
    const h = U.hoje();
    const conta = contaFiltro(ctx.conta);
    const abertas = st().lancamentos.filter((l) => l.tipo === 'despesa' && l.status !== 'pago' && (!conta || l.conta === conta))
      .sort((a, b) => (a.vencimento < b.vencimento ? -1 : 1));
    const grupos = [
      ['Atrasadas', abertas.filter((l) => l.vencimento < h)],
      ['Hoje', abertas.filter((l) => l.vencimento === h)],
      ['Próximos 7 dias', abertas.filter((l) => l.vencimento > h && U.diasEntre(h, l.vencimento) <= 7)],
      [`Resto de ${U.mesLabel(ctx.ym)}`, abertas.filter((l) => U.diasEntre(h, l.vencimento) > 7 && U.mesDe(l.vencimento) === ctx.ym)],
      ['Mais adiante', abertas.filter((l) => U.diasEntre(h, l.vencimento) > 7 && U.mesDe(l.vencimento) > ctx.ym)],
    ];
    const pagas = A.tesoureiro.doMes(ctx.ym, { conta, tipo: 'despesa', situacao: 'pago' });
    const soma = (ls) => ls.reduce((s, l) => s + l.valor, 0);
    const html = `
      <div class="grade-21">
        <section class="cartao secao-pagar">
          <header><h3>Em aberto</h3><span class="sub">${abertas.length} conta(s) · ${U.moeda(soma(abertas))}</span>
            <button class="btn" data-acao="gerar-recorrentes">Gerar recorrentes do mês</button></header>
          ${grupos.filter(([, ls]) => ls.length).map(([t, ls]) => `
            <h4><span>${t}</span><span>${U.moeda(soma(ls))}</span></h4>
            <div class="lista" style="margin-bottom:14px">${ls.slice(0, 30).map((l) => itemConta(l, h)).join('')}</div>`).join('') || '<p class="tudo-certo">Nenhuma conta em aberto. 👏</p>'}
        </section>
        <section class="cartao">
          <header><h3>Pagas em ${U.mesLabel(ctx.ym)}</h3><span class="sub">${U.moeda(soma(pagas))}</span></header>
          <div class="lista">${pagas.slice(0, 40).map((l) => `<div class="item" style="grid-template-columns:52px 1fr auto auto">
            <div class="dia"><b>${+l.pagoEm.slice(8, 10) || +l.data.slice(8, 10)}</b><span>${U.MESES_CURTOS[+(l.pagoEm || l.data).slice(5, 7) - 1]}</span></div>
            <div class="t">${e(l.descricao)}<small>${e(cat(l.categoriaId).nome)}</small></div>
            <div class="v">${U.moeda(l.valor)}</div>
            <button class="btn btn-l btn-pq" data-acao="alternar-pago" data-id="${l.id}" title="Desfazer">desfazer</button>
          </div>`).join('') || '<p class="vazio">Nada pago ainda neste mês.</p>'}</div>
        </section>
      </div>`;
    return { html: html.replace(' 👏', '') };
  }

  /* =============== IMPORTAR =============== */
  function importar(ctx) {
    const ia = A.ia.disponivel();
    const viaConta = A.ia.provedor() === 'conta';
    const r = ctx.rascunhos;
    const etapas = [['leitor', 'LE', 'Leitor'], ['ia', 'IA', 'Analista IA'], ['extrator', 'EX', 'Extrator'], ['classificador', 'CL', 'Classificador'], ['sentinela', 'SE', 'Sentinela']];
    const html = `
      <div class="grade-12">
        <section class="cartao">
          <header><h3>Enviar documentos</h3></header>
          <label class="soltar" id="soltar">
            <input type="file" id="arquivos" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.ofx,.txt" hidden>
            <h3>Arraste recibos, boletos e extratos</h3>
            <p>ou clique para escolher arquivos</p>
            <div class="formatos"><span class="etq">PDF</span><span class="etq">Foto do cupom</span><span class="etq">Boleto</span><span class="etq">Extrato CSV</span><span class="etq">OFX</span></div>
          </label>
          <div class="grade-campos mt">
            <label class="campo">Lançar na conta<select id="imp-conta">${opcoesContas(ctx.impConta || 'casal')}</select></label>
            <label class="campo">&nbsp;<span class="check"><input type="checkbox" id="imp-ia" ${ia ? '' : 'disabled'} ${ia && (viaConta || st().config.ia.sempre) ? 'checked' : ''}> ${viaConta ? 'Usar o Claude da sua conta' : 'Usar o Analista IA (Claude)'}</span></label>
          </div>
          ${viaConta ? '<p class="aviso-caixa mt"><b>Claude da sua conta ligado.</b> Valores e datas de extratos são lidos aqui no app; o Claude escolhe as categorias e lê fotos e PDFs escaneados. Na primeira vez o claude.ai pede sua permissão. Usa o limite do seu plano, sem chave de API.</p>' : ''}
          ${ia || FC.util.noClaude ? '' : '<p class="aviso-caixa mt">O Analista IA está desligado. Os documentos são lidos localmente pelo Extrator. Para ler fotos e PDFs digitalizados com mais precisão, coloque sua chave da API do Claude em <a href="#" data-acao="ir" data-aba="ajustes">Ajustes</a>.</p>'}
          <details class="mt"><summary class="muted" style="cursor:pointer">Colar texto (SMS do banco, notificação, e-mail)</summary>
            <textarea id="imp-texto" rows="4" class="mt" style="width:100%;border:var(--borda);border-radius:7px;padding:8px" placeholder="Ex.: Compra aprovada no cartão final 1234: R$ 54,90 em IFOOD em 03/11/2026"></textarea>
            <button class="btn mt" data-acao="importar-texto">Ler texto</button>
          </details>
          <p class="muted mt" style="font-size:12px">Extrato em planilha? Use colunas Data; Descrição; Valor (negativo = saída). <a href="#" data-acao="modelo-csv">Baixar modelo</a>.</p>
        </section>

        <section class="cartao">
          <header><h3>Linha de montagem</h3><span class="sub" id="pipe-arq">${ctx.processando ? 'processando…' : 'aguardando arquivos'}</span></header>
          <div class="pipeline" id="pipeline">${etapas.map(([id, s, n], i) => `${i ? '<span class="seta"></span>' : ''}<span class="etapa" data-etapa="${id}"><span class="sig">${s}</span>${n}</span>`).join('')}</div>
          <p class="muted" style="font-size:12.5px;margin:10px 0 0">O Leitor abre o arquivo, o Extrator (ou o Analista IA) encontra valor, datas e estabelecimento, o Classificador escolhe a categoria e a Sentinela confere se já não foi lançado. Nada entra no caixa sem a sua revisão.</p>
        </section>
      </div>

      <section class="cartao">
        <header><h3>Revisão</h3><span class="sub">${r.length ? `${r.length} item(ns) — confira e ajuste antes de lançar` : 'os itens lidos aparecem aqui'}</span>
          ${r.length ? '<button class="btn" data-acao="descartar-rascunhos">Descartar</button><button class="btn btn-p" data-acao="lancar-rascunhos">Lançar selecionados</button>' : ''}</header>
        ${r.length ? `<div class="tabela-envolve"><table class="tabela">
          <thead><tr><th style="width:28px"></th><th>Arquivo</th><th>Descrição</th><th>Categoria</th><th>Conta</th><th>Data</th><th>Status</th><th>Tipo</th><th class="num">Valor</th></tr></thead>
          <tbody>${r.map((x, i) => `<tr data-i="${i}" ${x.interno ? 'style="opacity:.6"' : ''}>
            <td><input type="checkbox" class="r-incluir" ${x.duplicado || x.interno ? '' : 'checked'}></td>
            <td style="max-width:160px"><span class="muted" style="font-size:12px;word-break:break-all">${e(x.arquivo || 'texto colado')}</span><br><span class="etq ${x.origem === 'ia' ? 'etq-ia' : ''}">${e(x.docTipo || '')}</span>${x.duplicado ? '<br><span class="st st-atrasado" style="cursor:default">já lançado?</span>' : ''}${x.interno ? '<br><span class="etq">entre contas</span>' : ''}</td>
            <td><input class="r-desc" value="${e(x.descricao)}" style="width:100%;min-width:150px"><br><span class="conf ${x.confiancaExtracao < 0.5 ? 'baixa' : ''}" title="Confiança na leitura"><i style="--c:${Math.round((x.confiancaExtracao || 0) * 100)}%"></i>leitura ${Math.round((x.confiancaExtracao || 0) * 100)}%</span>${x.linhaDigitavel ? ' <span class="etq">boleto</span>' : ''}${x.parcela ? ` <span class="etq">${x.parcela.n}/${x.parcela.total}</span>` : ''}</td>
            <td><select class="r-cat">${opcoesCategorias(x.categoriaId)}</select><br><span class="conf ${x.confianca < 0.5 ? 'baixa' : ''}" title="${e(x.motivo || '')}"><i style="--c:${Math.round((x.confianca || 0) * 100)}%"></i>${e(x.motivo || '')}</span></td>
            <td><select class="r-conta">${opcoesContas(x.conta)}</select></td>
            <td><input type="date" class="r-venc" value="${x.vencimento}"></td>
            <td><select class="r-status"><option value="pendente" ${x.status !== 'pago' ? 'selected' : ''}>a pagar</option><option value="pago" ${x.status === 'pago' ? 'selected' : ''}>pago</option></select></td>
            <td><select class="r-tipo"><option value="despesa" ${x.tipo !== 'receita' ? 'selected' : ''}>saída</option><option value="receita" ${x.tipo === 'receita' ? 'selected' : ''}>entrada</option></select></td>
            <td class="num"><input class="r-valor" value="${x.valor.toFixed(2).replace('.', ',')}" style="width:100px;text-align:right"></td>
          </tr>`).join('')}</tbody></table></div>` : '<p class="vazio">Envie um arquivo para começar. Dica: boletos em PDF já trazem valor e vencimento na linha digitável.</p>'}
      </section>`;
    return { html };
  }

  /* =============== ORÇAMENTO E RESERVAS =============== */
  function orcamento(ctx) {
    const aloc = A.planejador.alocacao(ctx.ym);
    const renda = A.tesoureiro.totais(ctx.ym).receitas;
    const orc = A.planejador.orcamentos(ctx.ym);
    const cores = G.SERIES;
    const totalOrc = orc.reduce((s, c) => s + (c.orcamento || 0), 0);
    const totalGasto = orc.reduce((s, c) => s + c.gasto, 0);
    const grupos = { essenciais: 'Essenciais', pessoal: 'Pessoais', metas: 'Metas' };
    const html = `
      <section class="cartao">
        <header><h3>Divisão da renda</h3><span class="sub">renda de ${U.mesLabel(ctx.ym)}: ${U.moeda(renda)}</span>
          <span id="soma-aloc" class="etq">soma 100%</span><button class="btn btn-p" data-acao="salvar-alocacao">Salvar divisão</button></header>
        <div class="alocacao">${aloc.filter((b) => b.id !== 'sobra').map((b, i) => `
          <div class="balde">
            <div class="topo-b"><i style="background:${cores[i]}"></i>${e(b.nome)}</div>
            <small>${e(b.desc)}</small>
            <div class="pct-in"><input type="number" min="0" max="100" step="1" value="${b.pctPlano}" data-balde="${b.id}"> % da renda</div>
            <div class="linha"><span>Planejado</span><b>${U.moeda(b.plano)}</b></div>
            <div class="linha"><span>Realizado</span><b>${U.moeda(b.real)}</b></div>
            ${G.progresso(b.plano ? b.real / b.plano * 100 : 0, b.id === 'reserva' || b.id === 'metas' ? 'meta' : undefined)}
            <small>${b.id === 'reserva' || b.id === 'metas'
              ? (b.real >= b.plano ? 'meta do mês cumprida' : `faltam ${U.moeda(b.plano - b.real)} para a meta`)
              : (b.real > b.plano ? `${U.moeda(b.real - b.plano)} acima do planejado` : `sobram ${U.moeda(b.plano - b.real)}`)}</small>
          </div>`).join('')}</div>
        <p class="muted mt" style="font-size:12.5px">Sugestão clássica: 50% essenciais, 20–30% pessoais, o resto para reserva e metas. Enquanto a reserva de emergência não estiver completa, vale mandar a fatia de metas para ela também.</p>
      </section>

      <section class="cartao">
        <header><h3>Orçamento por categoria</h3><span class="sub">${U.moeda(totalGasto)} de ${U.moeda(totalOrc)} previstos</span><button class="btn btn-p" data-acao="salvar-orcamentos">Salvar orçamentos</button></header>
        ${Object.entries(grupos).map(([g, nome]) => `
          <h4 class="muted" style="font-size:12px;text-transform:uppercase;letter-spacing:.07em;margin:10px 0 2px">${nome}</h4>
          ${orc.filter((c) => c.grupo === g).map((c) => `<div class="orc-linha">
            <span>${e(c.nome)}</span>
            <input type="number" min="0" step="10" value="${c.orcamento || 0}" data-orc="${c.id}" aria-label="Orçamento de ${e(c.nome)}">
            <span>${G.progresso(c.pct)}<small class="muted">${c.orcamento ? `${Math.round(c.pct)}% usado` : 'sem limite'}</small></span>
            <span class="num"><b>${U.moeda(c.gasto)}</b></span>
          </div>`).join('')}`).join('')}
      </section>`;
    return { html };
  }

  /* =============== CASAL =============== */
  function casal(ctx) {
    const a = A.divisor.acerto(ctx.ym);
    const d = st().config.divisao;
    const p = pessoas();
    const hist = A.divisor.historico(6, ctx.ym);
    const html = `
      <section class="cartao">
        <header><h3>Como dividimos a conta conjunta</h3></header>
        <div class="linha-acoes">
          <div class="segmentado" role="group">
            ${[['igual', 'Meio a meio'], ['proporcional', 'Proporcional à renda'], ['custom', 'Personalizado']].map(([v, n]) => `<button data-acao="modo-divisao" data-modo="${v}" class="${d.modo === v ? 'ativo' : ''}">${n}</button>`).join('')}
          </div>
          ${d.modo === 'custom' ? `<label class="campo" style="flex-direction:row;align-items:center;gap:8px">${e(p.a)} paga <input type="number" min="0" max="100" value="${d.pctA}" id="pct-a" style="width:70px"> %</label><button class="btn" data-acao="salvar-pct">Aplicar</button>` : ''}
          <span class="muted">${e(p.a)} ${Math.round(a.pctA)}% · ${e(p.b)} ${Math.round(a.pctB)}%${d.modo === 'proporcional' ? ' (calculado pela renda do mês)' : ''}</span>
        </div>
      </section>

      <section class="cartao">
        <header><h3>Acerto de ${U.mesLabel(ctx.ym)}</h3><span class="sub">considera só despesas conjuntas já pagas</span></header>
        <div class="acerto">
          <div class="pessoa"><h4>${e(p.a)}</h4>
            <div class="linha"><span>Pagou</span><b>${U.moeda(a.pagoA)}</b></div>
            <div class="linha"><span>Deveria pagar (${Math.round(a.pctA)}%)</span><b>${U.moeda(a.devidoA)}</b></div>
            <div class="linha"><span>Diferença</span><b class="${a.pagoA - a.devidoA < 0 ? 'neg' : ''}">${U.moeda(a.pagoA - a.devidoA)}</b></div>
          </div>
          <div class="seta-acerto">
            ${Math.abs(a.saldoA) < 1 ? '<b>Quites</b>contas equilibradas' : `<span class="flecha">${a.saldoA > 0 ? '←' : '→'}</span><b>${U.moeda(Math.abs(a.saldoA))}</b>${e(A.divisor.frase(a))}`}
            ${a.acertado ? `<div class="muted" style="font-size:12px;margin-top:4px">já acertado: ${U.moeda(Math.abs(a.acertado))}</div>` : ''}
            ${Math.abs(a.saldoA) >= 1 ? '<div class="mt"><button class="btn btn-m" data-acao="registrar-acerto">Registrar acerto</button></div>' : ''}
          </div>
          <div class="pessoa"><h4>${e(p.b)}</h4>
            <div class="linha"><span>Pagou</span><b>${U.moeda(a.pagoB)}</b></div>
            <div class="linha"><span>Deveria pagar (${Math.round(a.pctB)}%)</span><b>${U.moeda(a.devidoB)}</b></div>
            <div class="linha"><span>Diferença</span><b class="${a.pagoB - a.devidoB < 0 ? 'neg' : ''}">${U.moeda(a.pagoB - a.devidoB)}</b></div>
          </div>
        </div>
      </section>

      <div class="grade-21">
        <section class="cartao"><header><h3>Despesas conjuntas do mês</h3><span class="sub">${a.itens.length} itens · ajuste quem pagou</span></header>
          <div class="tabela-envolve"><table class="tabela"><thead><tr><th>Data</th><th>Descrição</th><th>Status</th><th>Quem pagou</th><th class="num">Valor</th></tr></thead><tbody>
          ${a.itens.map((l) => `<tr><td>${U.dataCurta(l.data)}</td><td class="desc">${e(l.descricao)}<small>${e(cat(l.categoriaId).nome)}</small></td><td>${pill(l)}</td>
            <td><select data-acao-change="pago-por" data-id="${l.id}"><option value="a" ${l.pagoPor === 'a' ? 'selected' : ''}>${e(p.a)}</option><option value="b" ${l.pagoPor === 'b' ? 'selected' : ''}>${e(p.b)}</option></select></td>
            <td class="num">${U.moeda(l.valor)}</td></tr>`).join('') || '<tr><td colspan="5" class="vazio">Sem despesas conjuntas neste mês.</td></tr>'}
          </tbody></table></div>
        </section>
        <section class="cartao"><header><h3>Últimos meses</h3></header>
          <table class="tabela"><thead><tr><th>Mês</th><th class="num">Conjunto</th><th class="num">Saldo</th></tr></thead><tbody>
          ${hist.map((m) => `<tr><td style="text-transform:capitalize">${U.mesCurto(m.ym)}</td><td class="num">${U.moeda(m.total)}</td><td class="num">${Math.abs(m.saldoA) < 1 ? '<span class="muted">quites</span>' : `${m.saldoA > 0 ? e(p.b) + ' → ' + e(p.a) : e(p.a) + ' → ' + e(p.b)}<br><b>${U.moeda(Math.abs(m.saldoA))}</b>`}</td></tr>`).join('')}
          </tbody></table>
        </section>
      </div>`;
    return { html };
  }

  /* =============== METAS =============== */
  function metas() {
    const ms = A.planejador.metas();
    const res = A.planejador.reserva(U.mesDe(U.hoje()));
    const html = `
      <section class="cartao">
        <header><h3>Reserva de emergência</h3><span class="sub">custo essencial médio: ${U.moeda(res.custoMensal)}/mês</span>
          <label class="campo" style="flex-direction:row;align-items:center;gap:8px">Meses de proteção <input type="number" min="1" max="24" value="${st().config.reservaMeses}" id="reserva-meses" style="width:64px"></label></header>
        <div class="grade-2">
          <div>
            <div style="display:flex;align-items:baseline;gap:10px"><span style="font-family:var(--fonte-titulo);font-size:30px">${U.moeda(res.guardado)}</span><span class="muted">de ${U.moeda(res.alvo)}</span></div>
            ${G.progresso(res.pct, 'meta')}
            <p class="muted" style="font-size:12.5px">Cobre <b>${res.meses.toFixed(1)} meses</b> de despesas essenciais. ${res.pct >= 100 ? 'Reserva completa — o excedente pode ir para as metas.' : `Faltam ${U.moeda(res.alvo - res.guardado)}.`}</p>
          </div>
          <div class="aviso-caixa"><b>Onde guardar:</b> algo com liquidez diária e baixo risco (Tesouro Selic, CDB com liquidez diária, conta remunerada). A reserva é para imprevistos — não para o casamento ou para a viagem.</div>
        </div>
        <div class="linha-acoes mt"><button class="btn btn-p" data-acao="aportar" data-id="reserva">Aportar na reserva</button><button class="btn" data-acao="retirar" data-id="reserva">Registrar retirada</button></div>
      </section>
      <section>
        <div class="linha-acoes" style="margin-bottom:12px"><h3 style="font-size:19px;margin-right:auto">Metas do casal</h3><button class="btn btn-p" data-acao="nova-meta">Nova meta</button></div>
        <div class="metas">${ms.filter((m) => !m.especial).map((m) => `
          <article class="meta">
            <h4>${e(m.nome)} <small>${m.prazo ? 'até ' + U.dataBR(m.prazo) : 'sem prazo'}</small></h4>
            <div class="valores"><b>${U.moeda(m.guardado)}</b><span>de ${U.moeda(m.alvo)}</span></div>
            ${G.progresso(m.pct, 'meta')}
            <div class="nota">${m.falta <= 0 ? 'Meta alcançada!' : m.meses ? `Guardem <b>${U.moeda(m.porMes)}/mês</b> por ${m.meses} meses para chegar lá.` : `Faltam ${U.moeda(m.falta)}.`}</div>
            <footer><button class="btn btn-pq btn-p" data-acao="aportar" data-id="${m.id}">Aportar</button><button class="btn btn-pq" data-acao="editar-meta" data-id="${m.id}">Editar</button><button class="btn btn-pq btn-l btn-perigo" data-acao="excluir-meta" data-id="${m.id}">Excluir</button></footer>
          </article>`).join('') || '<p class="vazio">Nenhuma meta ainda.</p>'}</div>
      </section>`;
    return { html };
  }

  /* =============== RELATÓRIOS =============== */
  function relatorios(ctx) {
    const conta = contaFiltro(ctx.conta);
    const serie = A.analista.serie(ctx.ym, 12, conta);
    const obs = A.analista.observacoes(ctx.ym, conta);
    const est = A.analista.porEstabelecimento(ctx.ym, conta, 8);
    const ano = serie.reduce((s, m) => ({ r: s.r + m.receitas, d: s.d + m.despesas }), { r: 0, d: 0 });
    const html = `
      <div class="linha-acoes"><button class="btn" data-acao="baixar-resumo">Baixar resumo (.txt)</button><button class="btn" data-acao="exportar-ano">Exportar 12 meses (CSV)</button>${FC.util.noClaude ? '' : '<button class="btn" data-acao="imprimir">Imprimir / salvar PDF</button>'}</div>
      <section class="cartao"><header><h3>Evolução mensal</h3><span class="sub">12 meses: receitas ${U.moeda(ano.r)} · despesas ${U.moeda(ano.d)} · guardado ${U.moeda(ano.r - ano.d)}</span></header><div id="g-linhas"></div></section>
      <div class="grade-2">
        <section class="cartao"><header><h3>O que o Analista observou</h3><span class="sub" style="text-transform:capitalize">${U.mesLabel(ctx.ym)}</span></header><ul class="obs">${obs.map((o) => `<li>${e(o)}</li>`).join('')}</ul></section>
        <section class="cartao"><header><h3>Despesas por categoria</h3></header><div id="g-cat"></div></section>
      </div>
      <div class="grade-2">
        <section class="cartao"><header><h3>Onde mais gastamos</h3></header>
          <table class="tabela"><thead><tr><th>Estabelecimento</th><th class="num">Vezes</th><th class="num">Total</th></tr></thead><tbody>
          ${est.map((x) => `<tr><td>${e(x.nome)}</td><td class="num">${x.vezes}</td><td class="num">${U.moeda(x.valor)}</td></tr>`).join('')}</tbody></table>
        </section>
        <section class="cartao"><header><h3>Tabela mensal</h3></header>
          <table class="tabela"><thead><tr><th>Mês</th><th class="num">Receitas</th><th class="num">Despesas</th><th class="num">Saldo</th></tr></thead><tbody>
          ${serie.slice().reverse().map((m) => `<tr><td style="text-transform:capitalize">${U.mesCurto(m.ym)}</td><td class="num">${U.moeda(m.receitas)}</td><td class="num">${U.moeda(m.despesas)}</td><td class="num ${m.saldo < 0 ? 'neg' : ''}">${U.moeda(m.saldo)}</td></tr>`).join('')}</tbody></table>
        </section>
      </div>`;
    const depois = () => {
      G.linhas(document.getElementById('g-linhas'), serie, [
        { chave: 'receitas', nome: 'Receitas', cor: G.SERIES[0] },
        { chave: 'despesas', nome: 'Despesas', cor: G.SERIES[1] },
      ]);
      G.barras(document.getElementById('g-cat'), A.analista.porCategoria(ctx.ym, conta), { max: 12, mostrarOrcamento: false });
    };
    return { html, depois };
  }

  /* =============== CATEGORIAS =============== */
  function categorias() {
    const usos = {};
    st().lancamentos.forEach((l) => { usos[l.categoriaId] = (usos[l.categoriaId] || 0) + 1; });
    const grupos = [['essenciais', 'Essencial'], ['pessoal', 'Pessoal'], ['metas', 'Metas / investimento'], ['receita', 'Receita']];
    const html = `
      <div class="grade-21">
        <section class="cartao"><header><h3>Categorias</h3><span class="sub">${st().categorias.length} categorias</span><button class="btn btn-p" data-acao="salvar-categorias">Salvar alterações</button></header>
          <div class="tabela-envolve"><table class="tabela"><thead><tr><th>Nome</th><th>Grupo</th><th class="num">Orçamento/mês</th><th class="num">Lançamentos</th><th></th></tr></thead><tbody>
          ${st().categorias.map((c) => `<tr data-cat="${c.id}">
            <td><input class="c-nome" value="${e(c.nome)}" style="width:100%"></td>
            <td><select class="c-grupo">${grupos.map(([v, n]) => `<option value="${v}" ${c.grupo === v ? 'selected' : ''}>${n}</option>`).join('')}</select></td>
            <td class="num"><input class="c-orc" type="number" min="0" step="10" value="${c.orcamento || 0}" style="width:100px;text-align:right" ${c.grupo === 'receita' ? 'disabled' : ''}></td>
            <td class="num">${usos[c.id] || 0}</td>
            <td class="acoes">${c.id === 'outros' ? '' : `<button class="btn btn-l btn-pq btn-perigo" data-acao="excluir-categoria" data-id="${c.id}">excluir</button>`}</td>
          </tr>`).join('')}</tbody></table></div>
        </section>
        <div style="display:flex;flex-direction:column;gap:20px">
          <section class="cartao"><header><h3>Nova categoria</h3></header>
            <div class="grade-campos">
              <label class="campo inteiro">Nome<input id="nova-cat-nome" placeholder="Ex.: Chá de panela"></label>
              <label class="campo">Grupo<select id="nova-cat-grupo">${grupos.map(([v, n]) => `<option value="${v}">${n}</option>`).join('')}</select></label>
              <label class="campo">Orçamento/mês<input id="nova-cat-orc" type="number" min="0" step="10" value="0"></label>
            </div>
            <button class="btn btn-p mt" data-acao="criar-categoria">Adicionar</button>
          </section>
          <section class="cartao"><header><h3>O que o Classificador aprendeu</h3><span class="sub">${st().regras.length} regra(s)</span></header>
            ${st().regras.length ? `<table class="tabela"><tbody>${st().regras.map((g, i) => `<tr><td>“${e(g.padrao)}”</td><td>→ ${e(cat(g.categoriaId).nome)}</td><td class="acoes"><button class="btn btn-l btn-pq" data-acao="esquecer-regra" data-i="${i}">esquecer</button></td></tr>`).join('')}</tbody></table>` : '<p class="muted">Quando você corrigir a categoria de um item importado, o Classificador guarda a regra aqui.</p>'}
          </section>
        </div>
      </div>`;
    return { html };
  }

  /* =============== AGENTES =============== */
  function agentes(ctx) {
    const lista = Object.values(FC.orquestrador.agentes);
    const nomes = Object.fromEntries(lista.map((a) => [a.id, a.nome]));
    const filtro = ctx.filtroAgente || 'todos';
    const diario = st().diario.filter((d) => filtro === 'todos' || d.agente === filtro).slice(0, 120);
    const html = `
      <section class="cartao"><header><h3>Equipe</h3><span class="sub">cada agente cuida de uma parte do controle</span>
        <button class="btn" data-acao="varredura">Rodar varredura</button><button class="btn" data-acao="gerar-recorrentes">Gerar recorrentes</button></header>
        <div class="agentes">${lista.map((a) => {
          const desligado = a.id === 'ia' && !A.ia.disponivel();
          return `<article class="agente ${a.status} ${desligado ? 'desligado' : ''}" data-agente="${a.id}">
            <header><span class="sig">${a.sigla}</span><h4>${e(a.nome)}</h4><span class="estado">${desligado ? 'sem chave' : a.status}</span></header>
            <p>${e(a.papel)}</p>
            <div class="ult">${(() => { const u = a.ultimaAcao || (st().diario.find((d) => d.agente === a.id) || {}).mensagem; return u ? e(u) : 'Ainda não trabalhou.'; })()}</div>
          </article>`;
        }).join('')}</div>
      </section>
      <section class="cartao"><header><h3>Diário de bordo</h3>
        <select data-acao-change="filtro-agente"><option value="todos">Todos os agentes</option>${lista.map((a) => `<option value="${a.id}" ${filtro === a.id ? 'selected' : ''}>${e(a.nome)}</option>`).join('')}</select>
        <button class="btn btn-l" data-acao="limpar-diario">limpar</button></header>
        ${diario.length ? `<ul class="diario">${diario.map((d) => {
          const dt = new Date(d.em);
          return `<li class="${d.nivel}"><time>${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}</time><span class="quem">${e(nomes[d.agente] || d.agente)}</span><span class="msg">${e(d.mensagem)}</span></li>`;
        }).join('')}</ul>` : '<p class="vazio">Nada registrado ainda.</p>'}
      </section>`;
    return { html };
  }

  /* =============== AJUSTES =============== */
  function ajustes() {
    const c = st().config;
    const html = `
      <div class="grade-2">
        <section class="cartao"><header><h3>Pessoas</h3></header>
          <div class="grade-campos">
            <label class="campo">Você<input id="aj-a" value="${e(c.pessoas.a)}"></label>
            <label class="campo">Sua noiva<input id="aj-b" value="${e(c.pessoas.b)}"></label>
          </div>
          <button class="btn btn-p mt" data-acao="salvar-pessoas">Salvar nomes</button>
        </section>
        ${FC.util.noClaude ? `<section class="cartao"><header><h3>Claude da sua conta</h3><span class="sub">${A.ia.provedor() === 'conta' ? 'ligado' : 'não liberado'}</span></header>
          <p style="margin-top:0">${A.ia.provedor() === 'conta'
            ? 'O app pede ao Claude da sua conta para ler fotos e PDFs escaneados e para classificar as linhas dos extratos. Não precisa de chave de API: usa o limite do seu plano.'
            : 'O Claude ainda não foi liberado para esta página. Permita quando o claude.ai perguntar, ou pelo menu de permissões da página. Enquanto isso, os agentes locais fazem a leitura.'}</p>
          <div class="linha-acoes"><button class="btn" data-acao="testar-ia" ${A.ia.provedor() ? '' : 'disabled'}>Testar conexão</button></div>
        </section>` : `        <section class="cartao"><header><h3>Analista IA (Claude)</h3><span class="sub">${A.ia.disponivel() ? 'ligado' : 'desligado'}</span></header>
          <div class="grade-campos">
            <label class="campo inteiro">Chave da API Anthropic<input id="aj-chave" type="password" placeholder="sk-ant-…" value="${e(c.ia.apiKey)}" autocomplete="off"></label>
            <label class="campo">Modelo<select id="aj-modelo">${[['claude-opus-5-5', 'Claude Opus 5.5 (mais preciso)'], ['claude-sonnet-5-5', 'Claude Sonnet 5.5 (equilíbrio)'], ['claude-haiku-5-5', 'Claude Haiku 5.5 (mais barato)']].map(([v, n]) => `<option value="${v}" ${c.ia.modelo === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
            <label class="campo">&nbsp;<span class="check"><input type="checkbox" id="aj-sempre" ${c.ia.sempre ? 'checked' : ''}> Usar IA em todo documento</span></label>
          </div>
          <p class="aviso-caixa mt">A chave fica salva só neste navegador e nunca vai para o backup. O documento é enviado direto do seu navegador para a API da Anthropic. Sem chave, tudo funciona localmente com o Extrator.</p>
          <div class="linha-acoes mt"><button class="btn btn-p" data-acao="salvar-ia">Salvar</button><button class="btn" data-acao="testar-ia">Testar conexão</button></div>
        </section>`}
      </div>
      <div class="grade-2">
        ${FC.util.noClaude ? '' : `<section class="cartao"><header><h3>Leitura de fotos sem IA</h3></header>
          <label class="check"><input type="checkbox" id="aj-ocr" data-acao-change="ocr" ${c.ocr ? 'checked' : ''}> Ativar OCR local (Tesseract) para fotos de cupom quando a IA estiver desligada</label>
          <p class="muted" style="font-size:12.5px">Baixa ~10 MB na primeira vez e roda no seu navegador. É mais lento e menos preciso que a IA, mas não envia nada para fora.</p>
        </section>`}
        <section class="cartao"><header><h3>Backup e dados</h3></header>
          <div class="linha-acoes">
            <button class="btn btn-p" data-acao="backup">Baixar backup (JSON)</button>
            <label class="btn">Restaurar backup<input type="file" accept=".json" id="restaurar" hidden></label>
            <button class="btn" data-acao="exportar-tudo">Exportar tudo (CSV)</button>
          </div>
          <p class="muted mt" style="font-size:12.5px">${FC.nuvem.estado === 'nuvem'
            ? 'Seus dados ficam guardados na nuvem do claude.ai, nesta página: abra o mesmo link no celular ou no computador e está tudo lá. Só você e quem você der acesso de edição veem os dados. O backup é uma cópia extra para guardar.'
            : 'Seus dados ficam guardados no navegador deste aparelho. Faça backup de vez em quando e, para usar em outro aparelho, restaure o arquivo lá.'}</p>
          <div class="linha-acoes mt">${FC.util.noClaude ? '' : '<button class="btn" data-acao="carregar-exemplo">Recarregar dados de exemplo</button>'}<button class="btn btn-perigo" data-acao="zerar">Começar do zero</button></div>
          ${st().demo ? '<p class="aviso-caixa mt"><b>Você está vendo dados de exemplo.</b> Quando quiser usar de verdade, clique em “Começar do zero” (categorias e ajustes são mantidos).</p>' : ''}
        </section>
      </div>`;
    return { html };
  }

  return { visao, lancamentos, pagar, importar, orcamento, casal, metas, relatorios, categorias, agentes, ajustes, opcoesCategorias, opcoesContas };
})();
