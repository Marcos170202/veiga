/*
 * Agente Analista IA (opcional) — usa o Claude para ler recibos difíceis:
 * PDFs digitalizados, fotos de cupom, faturas com layout estranho.
 * Só roda se você colocar sua chave da API em Ajustes. A chave fica neste navegador.
 */
FC.agentes.ia = (() => {
  const O = FC.orquestrador;
  const U = FC.util;
  O.registrar({
    id: 'ia', nome: 'Analista IA', sigla: 'IA',
    papel: 'Opcional. Envia o documento ao Claude e recebe valor, datas, itens e categoria já estruturados.',
  });

  let clienteCache = null;
  let chaveCache = '';

  function disponivel() { return !!FC.store.estado.config.ia.apiKey; }

  async function cliente() {
    const chave = FC.store.estado.config.ia.apiKey;
    if (clienteCache && chaveCache === chave) return clienteCache;
    const { default: Anthropic } = await import('https://esm.sh/@anthropic-ai/sdk');
    clienteCache = new Anthropic({ apiKey: chave, dangerouslyAllowBrowser: true });
    chaveCache = chave;
    return clienteCache;
  }

  function esquema() {
    const cats = FC.store.estado.categorias.map((c) => c.id);
    return {
      type: 'object',
      additionalProperties: false,
      required: ['tipo', 'estabelecimento', 'descricao', 'cnpj', 'valor_total', 'data', 'vencimento', 'forma_pagamento', 'tipo_documento', 'categoria', 'itens', 'parcela_atual', 'parcelas_total', 'confianca'],
      properties: {
        tipo: { type: 'string', enum: ['despesa', 'receita'] },
        estabelecimento: { type: 'string', description: 'Nome fantasia de quem recebeu o pagamento' },
        descricao: { type: 'string', description: 'Descrição curta para o lançamento, ex.: "Enel — energia out/2026"' },
        cnpj: { type: 'string', description: 'CNPJ ou string vazia' },
        valor_total: { type: 'number', description: 'Valor final pago ou a pagar, em reais' },
        data: { type: 'string', description: 'Data da compra/emissão em AAAA-MM-DD, ou vazia' },
        vencimento: { type: 'string', description: 'Data de vencimento em AAAA-MM-DD, ou vazia' },
        forma_pagamento: { type: 'string', enum: ['pix', 'cartao', 'debito', 'boleto', 'dinheiro', 'outro'] },
        tipo_documento: { type: 'string', description: 'Ex.: Nota fiscal, Boleto, Comprovante Pix, Fatura, Recibo' },
        categoria: { type: 'string', enum: cats },
        itens: {
          type: 'array',
          items: {
            type: 'object', additionalProperties: false, required: ['nome', 'valor'],
            properties: { nome: { type: 'string' }, valor: { type: 'number' } },
          },
        },
        parcela_atual: { type: 'integer', description: '0 se não for parcelado' },
        parcelas_total: { type: 'integer', description: '0 se não for parcelado' },
        confianca: { type: 'number', description: 'De 0 a 1, quão seguro você está do valor e das datas' },
      },
    };
  }

  async function analisar(lido) {
    O.status('ia', 'trabalhando');
    O.log('ia', `Enviando "${lido.nome}" ao Claude…`);
    try {
      const cfg = FC.store.estado.config.ia;
      const cats = FC.store.estado.categorias.map((c) => `${c.id} = ${c.nome} (${c.grupo})`).join('\n');
      const conteudo = [];
      if (lido.tipo === 'pdf' || lido.tipo === 'imagem') {
        const data = await U.arquivoParaBase64(lido.arquivo);
        conteudo.push(lido.tipo === 'pdf'
          ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
          : { type: 'image', source: { type: 'base64', media_type: lido.mime || 'image/jpeg', data } });
      } else {
        conteudo.push({ type: 'text', text: lido.texto.slice(0, 50000) });
      }
      conteudo.push({
        type: 'text',
        text: `Este é um documento financeiro pessoal brasileiro (recibo, nota fiscal, boleto, fatura ou comprovante).
Extraia os dados para um controle financeiro de um casal. Use o valor FINAL (após descontos), não subtotais.
Datas no formato AAAA-MM-DD. Hoje é ${U.hoje()}.
Escolha a categoria mais adequada entre:
${cats}`,
      });

      const c = await cliente();
      const resp = await c.beta.messages.create({
        model: cfg.modelo || 'claude-opus-5-5',
        max_tokens: 4000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low', format: { type: 'json_schema', schema: esquema() } },
        messages: [{ role: 'user', content: conteudo }],
      });
      if (resp.stop_reason === 'refusal') throw new Error('o modelo recusou este documento');
      const bloco = resp.content.find((b) => b.type === 'text');
      if (!bloco) throw new Error('resposta vazia');
      const j = JSON.parse(bloco.text);

      const r = {
        tipo: j.tipo,
        descricao: j.descricao || j.estabelecimento,
        estabelecimento: j.estabelecimento,
        cnpj: j.cnpj,
        valor: Math.round((j.valor_total || 0) * 100) / 100,
        data: j.data || j.vencimento || U.hoje(),
        vencimento: j.vencimento || j.data || U.hoje(),
        forma: j.forma_pagamento,
        docTipo: j.tipo_documento,
        itens: j.itens || [],
        parcela: j.parcelas_total > 1 ? { n: j.parcela_atual || 1, total: j.parcelas_total } : null,
        categoriaId: j.categoria,
        confianca: j.confianca,
        confiancaExtracao: j.confianca,
        origem: 'ia',
      };
      // regras que você ensinou valem mais que o palpite da IA
      const regra = FC.store.estado.regras.find((g) => U.normalizar(r.descricao).includes(g.padrao));
      if (regra) { r.categoriaId = regra.categoriaId; r.confianca = 0.97; }

      O.log('ia', `${r.docTipo}: ${r.estabelecimento} — ${U.moeda(r.valor)}, categoria ${FC.store.categoria(r.categoriaId).nome} (${Math.round((j.confianca || 0) * 100)}%).`);
      return r;
    } finally {
      O.status('ia', 'ocioso');
    }
  }

  async function testar() {
    const c = await cliente();
    const resp = await c.messages.create({
      model: FC.store.estado.config.ia.modelo || 'claude-opus-5-5',
      max_tokens: 50,
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: 'Responda apenas: ok' }],
    });
    O.log('ia', 'Conexão com o Claude testada com sucesso.');
    return resp;
  }

  return { disponivel, analisar, testar };
})();
