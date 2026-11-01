/*
 * Agente Analista IA — usa o Claude para ler recibos difíceis e classificar extratos.
 *
 * Dois jeitos de falar com o Claude:
 *  • "conta": publicado no claude.ai, o app pede ao Claude da SUA conta (sem chave de API,
 *    usa o limite do seu plano; o claude.ai pede sua permissão na primeira vez).
 *  • "chave": fora do claude.ai, com uma chave da API em Ajustes (opcional, cobrança à parte).
 * Sem nenhum dos dois, o app segue funcionando com os agentes locais.
 */
FC.agentes.ia = (() => {
  const O = FC.orquestrador;
  const U = FC.util;
  const st = () => FC.store.estado;
  O.registrar({
    id: 'ia', nome: 'Analista IA', sigla: 'IA',
    papel: 'Pede ao Claude para ler recibos difíceis (fotos, PDFs escaneados) e para classificar as linhas de extratos.',
  });

  let sample = null;   // função do claude.ai (Claude da conta)
  let limites = null;
  let recusado = false;
  let clienteCache = null, chaveCache = '';

  /* ---------- conexão ---------- */
  async function iniciar() {
    if (!U.noClaude) return;
    try {
      sample = await window.claude.use('sample');
      if (sample) limites = await sample.limits().catch(() => null);
    } catch (e) { sample = null; }
    if (sample) O.log('ia', 'Conectado ao Claude da sua conta (sem chave de API).');
    O.emitir('mudou');
  }

  function provedor() {
    if (sample && !recusado) return 'conta';
    if (!U.noClaude && st().config.ia.apiKey) return 'chave';
    return null;
  }
  const disponivel = () => !!provedor();
  const aceitaImagens = () => provedor() === 'chave' || !!(limites && limites.images);

  function explicarErro(e) {
    const c = e && e.code;
    if (c === 'not_granted' || c === 'sampling_disabled' || c === 'not_declared' || c === 'capability_disabled') {
      recusado = true;
      return 'o Claude não foi liberado para esta página — sigo com os agentes locais';
    }
    if (c === 'rate_limited') return 'limite de uso do Claude atingido agora — tente mais tarde';
    if (c === 'session_expired') return 'sua sessão no Claude expirou — entre de novo';
    if (c === 'image_rejected') return 'a imagem não foi aceita (tamanho ou formato)';
    if (c === 'refused') return 'o Claude não quis processar este documento';
    if (c === 'invalid_json') return 'resposta fora do formato esperado';
    return (e && (e.message || c)) || 'falha desconhecida';
  }

  /* ---------- chave de API (opcional, fora do claude.ai) ---------- */
  async function cliente() {
    const chave = st().config.ia.apiKey;
    if (clienteCache && chaveCache === chave) return clienteCache;
    const { default: Anthropic } = await import('https://esm.sh/@anthropic-ai/sdk');
    clienteCache = new Anthropic({ apiKey: chave, dangerouslyAllowBrowser: true });
    chaveCache = chave;
    return clienteCache;
  }

  async function jsonPorChave(conteudo, schema) {
    const c = await cliente();
    const resp = await c.beta.messages.create({
      model: st().config.ia.modelo || 'claude-opus-5-5',
      max_tokens: 8000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema } },
      messages: [{ role: 'user', content: conteudo }],
    });
    if (resp.stop_reason === 'refusal') throw { code: 'refused' };
    const bloco = resp.content.find((b) => b.type === 'text');
    if (!bloco) throw new Error('resposta vazia');
    return JSON.parse(bloco.text);
  }

  /* ---------- descrição das categorias para o Claude ---------- */
  function listaCategorias() {
    return st().categorias.map((c) => `${c.id} = ${c.nome} (${c.grupo === 'receita' ? 'entrada' : c.grupo})`).join('\n');
  }
  const idsReceita = () => st().categorias.filter((c) => c.grupo === 'receita').map((c) => c.id);
  const idsDespesa = () => st().categorias.filter((c) => c.grupo !== 'receita').map((c) => c.id);

  /* ================= 1) Ler um recibo / boleto / foto ================= */
  const FORMATO_RECIBO = `{"tipo":"despesa ou receita","estabelecimento":"nome fantasia","descricao":"descrição curta para o lançamento","cnpj":"ou vazio","valor_total":0.00,"data":"AAAA-MM-DD ou vazio","vencimento":"AAAA-MM-DD ou vazio","forma_pagamento":"pix|cartao|debito|boleto|dinheiro|outro","tipo_documento":"Nota fiscal, Boleto, Comprovante Pix, Fatura, Recibo…","categoria":"id da lista","itens":[{"nome":"","valor":0.00}],"parcela_atual":0,"parcelas_total":0,"confianca":0.0}`;

  function instrucaoRecibo() {
    return `Você está ajudando um casal brasileiro a controlar as finanças. Leia o documento financeiro (recibo, nota fiscal, boleto, fatura ou comprovante) e extraia os dados.
Regras: use o valor FINAL pago ou a pagar (depois de descontos), nunca subtotais. Datas no formato AAAA-MM-DD; hoje é ${U.hoje()}. "confianca" vai de 0 a 1 e diz quão seguro você está do valor e das datas. Se não for parcelado, parcela_atual e parcelas_total são 0.
Escolha "categoria" usando exatamente um destes ids:
${listaCategorias()}
Responda somente com um objeto JSON neste formato:
${FORMATO_RECIBO}`;
  }

  function normalizarRecibo(j) {
    const cats = st().categorias.map((c) => c.id);
    const tipo = j.tipo === 'receita' ? 'receita' : 'despesa';
    const dataOk = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : '');
    const valor = Math.round((Number(j.valor_total) || 0) * 100) / 100;
    const r = {
      tipo,
      descricao: String(j.descricao || j.estabelecimento || 'Documento').slice(0, 80),
      estabelecimento: String(j.estabelecimento || ''),
      cnpj: String(j.cnpj || ''),
      valor,
      data: dataOk(j.data) || dataOk(j.vencimento) || U.hoje(),
      vencimento: dataOk(j.vencimento) || dataOk(j.data) || U.hoje(),
      forma: ['pix', 'cartao', 'debito', 'boleto', 'dinheiro', 'outro'].includes(j.forma_pagamento) ? j.forma_pagamento : 'pix',
      docTipo: String(j.tipo_documento || 'Documento'),
      itens: Array.isArray(j.itens) ? j.itens.slice(0, 30).map((i) => ({ nome: String(i.nome || ''), valor: Number(i.valor) || 0 })) : [],
      parcela: Number(j.parcelas_total) > 1 ? { n: Number(j.parcela_atual) || 1, total: Number(j.parcelas_total) } : null,
      categoriaId: cats.includes(j.categoria) ? j.categoria : (tipo === 'receita' ? 'extra' : 'outros'),
      confianca: Math.max(0, Math.min(1, Number(j.confianca) || 0.6)),
      origem: 'ia',
      motivo: 'escolhida pelo Claude',
    };
    r.confiancaExtracao = r.confianca;
    const jaPago = /nota fiscal|cupom|comprovante|recibo/i.test(r.docTipo);
    r.status = jaPago ? 'pago' : 'pendente';
    r.pagoEm = jaPago ? r.data : '';
    const regra = st().regras.find((g) => U.normalizar(r.descricao).includes(g.padrao));
    if (regra) { r.categoriaId = regra.categoriaId; r.confianca = 0.97; r.motivo = `regra aprendida: "${regra.padrao}"`; }
    return r;
  }

  async function analisar(lido) {
    const via = provedor();
    if (!via) throw new Error('Claude não está disponível');
    O.status('ia', 'trabalhando');
    O.log('ia', `Pedindo ao Claude${via === 'conta' ? ' da sua conta' : ''} para ler "${lido.nome}"…`);
    try {
      let j;
      const temTexto = (lido.texto || '').trim().length >= 25;
      if (via === 'conta') {
        const opcoes = { modelTier: 'default', effort: 'low' };
        let texto = '';
        if (temTexto) texto = `\n\nTexto extraído do documento:\n"""\n${lido.texto.slice(0, 40000)}\n"""`;
        else if (lido.tipo === 'imagem') opcoes.images = [lido.arquivo];
        else if (lido.tipo === 'pdf') opcoes.images = await FC.agentes.leitor.paginasComoImagens(lido.arquivo, (limites && limites.images && limites.images.maxCount) || 3);
        if (opcoes.images && !aceitaImagens()) throw new Error('esta visualização não envia imagens ao Claude');
        j = await sample.json(instrucaoRecibo() + (opcoes.images ? '\n\nO documento está nas imagens anexadas.' : texto), opcoes);
      } else {
        const conteudo = [];
        if (lido.tipo === 'pdf' || lido.tipo === 'imagem') {
          const data = await U.arquivoParaBase64(lido.arquivo);
          conteudo.push(lido.tipo === 'pdf'
            ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
            : { type: 'image', source: { type: 'base64', media_type: lido.mime || 'image/jpeg', data } });
        } else conteudo.push({ type: 'text', text: lido.texto.slice(0, 50000) });
        conteudo.push({ type: 'text', text: instrucaoRecibo() });
        j = await jsonPorChave(conteudo, esquemaRecibo());
      }
      if (!j || typeof j !== 'object' || Array.isArray(j)) throw { code: 'invalid_json' };
      const r = normalizarRecibo(j);
      O.log('ia', `${r.docTipo}: ${r.estabelecimento || r.descricao} — ${U.moeda(r.valor)}, ${FC.store.categoria(r.categoriaId).nome} (${Math.round(r.confianca * 100)}%).`);
      return r;
    } catch (e) {
      throw new Error(explicarErro(e));
    } finally {
      O.status('ia', 'ocioso');
    }
  }

  /* ================= 2) Classificar várias linhas de extrato de uma vez ================= */
  async function classificarLote(rascunhos) {
    const via = provedor();
    if (!via) return 0;
    const alvos = rascunhos.filter((r) => !r.interno && !/^regra aprendida/.test(r.motivo || ''));
    if (!alvos.length) return 0;
    O.status('ia', 'trabalhando');
    O.log('ia', `Pedindo ao Claude${via === 'conta' ? ' da sua conta' : ''} para classificar ${alvos.length} movimentação(ões)…`);
    const p = st().config.pessoas;
    let aplicadas = 0;
    try {
      for (let ini = 0; ini < alvos.length; ini += 80) {
        const bloco = alvos.slice(ini, ini + 80);
        const linhas = bloco.map((r, i) => `${i}\t${r.tipo === 'receita' ? 'ENTRADA' : 'SAÍDA'}\t${r.valor.toFixed(2)}\t${r.descricao}\t${(r.notas || '').slice(0, 140)}`).join('\n');
        const instrucao = `Você está ajudando um casal brasileiro (${p.a} e ${p.b}) a categorizar movimentações de um extrato bancário de ${p.a}.
Para cada linha, escolha a categoria mais provável. Use o nome do estabelecimento ou da pessoa e o texto original da linha.
Dicas: depósitos recorrentes de empresa costumam ser salário ou bonificação; Pix entre pessoas físicas vai para "Pix para pessoas" (saída) ou "Transferências recebidas" (entrada), a menos que o nome deixe claro outra coisa; pagamento de fatura de cartão vai para a fatura do cartão.
Ids permitidos para ENTRADA: ${idsReceita().join(', ')}
Ids permitidos para SAÍDA: ${idsDespesa().join(', ')}
Categorias:
${listaCategorias()}

Linhas (índice, tipo, valor em R$, descrição, linha original do extrato):
${linhas}

Responda somente com um array JSON, um objeto por linha, no formato:
[{"i":0,"categoria":"id","confianca":0.0,"motivo":"até 6 palavras em português"}]`;
        let lista;
        if (via === 'conta') lista = await sample.json(instrucao, { modelTier: 'default', effort: 'low' });
        else lista = (await jsonPorChave([{ type: 'text', text: instrucao }], esquemaLote())).itens;
        if (!Array.isArray(lista)) throw { code: 'invalid_json' };
        lista.forEach((x) => {
          const r = bloco[Number(x.i)];
          if (!r) return;
          const permitidos = r.tipo === 'receita' ? idsReceita() : idsDespesa();
          if (!permitidos.includes(x.categoria)) return;
          r.categoriaId = x.categoria;
          r.confianca = Math.max(0, Math.min(1, Number(x.confianca) || 0.7));
          r.motivo = `Claude: ${String(x.motivo || '').slice(0, 60)}`;
          r.origem = 'ia';
          aplicadas++;
        });
      }
      O.log('ia', `Classifiquei ${aplicadas} de ${alvos.length} movimentação(ões).`);
    } catch (e) {
      O.log('ia', `Não consegui classificar com o Claude: ${explicarErro(e)}. Mantive as categorias do Classificador local.`, 'aviso');
    } finally {
      O.status('ia', 'ocioso');
    }
    return aplicadas;
  }

  /* ---------- esquemas para a API por chave ---------- */
  function esquemaRecibo() {
    const cats = st().categorias.map((c) => c.id);
    return {
      type: 'object', additionalProperties: false,
      required: ['tipo', 'estabelecimento', 'descricao', 'cnpj', 'valor_total', 'data', 'vencimento', 'forma_pagamento', 'tipo_documento', 'categoria', 'itens', 'parcela_atual', 'parcelas_total', 'confianca'],
      properties: {
        tipo: { type: 'string', enum: ['despesa', 'receita'] },
        estabelecimento: { type: 'string' }, descricao: { type: 'string' }, cnpj: { type: 'string' },
        valor_total: { type: 'number' }, data: { type: 'string' }, vencimento: { type: 'string' },
        forma_pagamento: { type: 'string', enum: ['pix', 'cartao', 'debito', 'boleto', 'dinheiro', 'outro'] },
        tipo_documento: { type: 'string' }, categoria: { type: 'string', enum: cats },
        itens: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['nome', 'valor'], properties: { nome: { type: 'string' }, valor: { type: 'number' } } } },
        parcela_atual: { type: 'integer' }, parcelas_total: { type: 'integer' }, confianca: { type: 'number' },
      },
    };
  }
  function esquemaLote() {
    return {
      type: 'object', additionalProperties: false, required: ['itens'],
      properties: { itens: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['i', 'categoria', 'confianca', 'motivo'], properties: { i: { type: 'integer' }, categoria: { type: 'string', enum: st().categorias.map((c) => c.id) }, confianca: { type: 'number' }, motivo: { type: 'string' } } } } },
    };
  }

  async function testar() {
    const via = provedor();
    if (via === 'conta') { await sample('Responda apenas: ok', { modelTier: 'quick', cache: false }); }
    else if (via === 'chave') {
      const c = await cliente();
      await c.messages.create({ model: st().config.ia.modelo || 'claude-opus-5-5', max_tokens: 50, output_config: { effort: 'low' }, messages: [{ role: 'user', content: 'Responda apenas: ok' }] });
    } else throw new Error('nenhuma conexão configurada');
    O.log('ia', 'Conexão com o Claude testada com sucesso.');
  }

  return { iniciar, disponivel, provedor, aceitaImagens, analisar, classificarLote, testar, explicarErro };
})();
