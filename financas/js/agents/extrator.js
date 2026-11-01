/* Agente Extrator — encontra valor, datas, estabelecimento, CNPJ e boletos no texto; lê extratos CSV/OFX. */
FC.agentes.extrator = (() => {
  const O = FC.orquestrador;
  const U = FC.util;
  O.registrar({
    id: 'extrator', nome: 'Extrator', sigla: 'EX',
    papel: 'Acha valores, datas, vencimento, CNPJ e linha digitável de boletos; converte extratos em lançamentos.',
  });

  const RE_VALOR = /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/g;
  const RE_CNPJ = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/;
  const MESES = { janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };
  const ROTULOS_TOTAL = [
    /valor\s+(?:total\s+)?a\s+pagar/i, /total\s+a\s+pagar/i, /valor\s+do\s+documento/i, /valor\s+cobrado/i,
    /valor\s+total/i, /total\s+geral/i, /valor\s+pago/i, /valor\s+da\s+transfer[eê]ncia/i, /\btotal\b/i, /\bvalor\b/i,
  ];
  const GENERICAS = /^(documento auxiliar|danfe|nota fiscal|nfc-?e|cupom|recibo|comprovante|extrato|fatura|boleto|pagamento|via do cliente|consumidor|cnpj|cpf|data|hora|endere[cç]o|banco|ag[eê]ncia)/i;

  function paraISO(d, m, y) {
    y = +y; if (y < 100) y += 2000;
    if (m < 1 || m > 12 || d < 1 || d > 31) return '';
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  function datasNoTexto(txt) {
    const achadas = [];
    const re = /\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/g;
    let m;
    while ((m = re.exec(txt))) { const iso = paraISO(+m[1], +m[2], m[3]); if (iso) achadas.push({ iso, pos: m.index }); }
    const reExt = /\b(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})/gi;
    while ((m = reExt.exec(txt))) {
      const mes = MESES[U.normalizar(m[2])];
      if (mes) achadas.push({ iso: paraISO(+m[1], mes, m[3]), pos: m.index });
    }
    return achadas;
  }

  function dataRotulada(linhas, rotulo) {
    for (const l of linhas) {
      if (rotulo.test(l)) {
        const d = datasNoTexto(l);
        if (d.length) return d[0].iso;
      }
    }
    return '';
  }

  /* Boleto bancário (47 dígitos) e de concessionária/arrecadação (48 dígitos, começa com 8). */
  function lerBoleto(txt) {
    const candidatos = txt.replace(/[^\d\s.\-]/g, ' ').match(/(?:\d[\d.\s\-]{44,64}\d)/g) || [];
    for (const c of candidatos) {
      const dig = c.replace(/\D/g, '');
      if (dig.length === 47) {
        const fator = +dig.slice(33, 37);
        const valor = +dig.slice(37, 47) / 100;
        let venc = '';
        if (fator >= 1000) {
          // fator 1000 = 03/07/2000; o fator reinicia em 1000 a cada 9000 dias (último reinício: 22/02/2025)
          const base = new Date(1997, 9, 7);
          let d = new Date(base.getTime() + fator * 86400000);
          const limite = new Date(); limite.setFullYear(limite.getFullYear() - 5);
          while (d < limite) d = new Date(d.getTime() + 9000 * 86400000);
          venc = U.iso(d);
        }
        return { linha: dig, tipo: 'bancario', valor, vencimento: venc };
      }
      if (dig.length === 48 && dig[0] === '8') {
        const cod = [0, 12, 24, 36].map((i) => dig.slice(i, i + 11)).join('');
        const real = ['6', '7'].includes(cod[2]);
        return { linha: dig, tipo: 'arrecadacao', valor: real ? +cod.slice(4, 15) / 100 : 0, vencimento: '' };
      }
    }
    return null;
  }

  function acharValor(linhas) {
    for (const rot of ROTULOS_TOTAL) {
      for (let i = 0; i < linhas.length; i++) {
        if (!rot.test(linhas[i])) continue;
        if (/sub-?total|desconto|troco|tributos|impostos|aprox/i.test(linhas[i])) continue;
        const vals = (linhas[i].match(RE_VALOR) || []).map(U.parseValor).filter((v) => v > 0);
        if (vals.length) return { valor: vals[vals.length - 1], como: 'rótulo' };
        const prox = (linhas[i + 1] || '').match(RE_VALOR);
        if (prox) return { valor: U.parseValor(prox[0]), como: 'rótulo' };
      }
    }
    const todos = linhas.flatMap((l) => (l.match(RE_VALOR) || []).map(U.parseValor)).filter((v) => v > 0 && v < 1e7);
    if (todos.length) return { valor: Math.max(...todos), como: 'maior valor' };
    return { valor: 0, como: '' };
  }

  function acharEstabelecimento(linhas, nomeArquivo) {
    for (const rot of [/benefici[aá]rio|cedente/i, /raz[aã]o social/i, /favorecido|recebedor|destinat[aá]rio|para\s*:/i, /nome fantasia/i]) {
      for (let i = 0; i < linhas.length; i++) {
        if (!rot.test(linhas[i])) continue;
        const resto = linhas[i].split(/[:\-]\s*/).slice(1).join(' ').replace(RE_CNPJ, '').trim();
        if (resto.length > 2) return limpar(resto);
        if (linhas[i + 1] && linhas[i + 1].length > 2) return limpar(linhas[i + 1]);
      }
    }
    const iCnpj = linhas.findIndex((l) => RE_CNPJ.test(l));
    if (iCnpj > 0 && !GENERICAS.test(linhas[iCnpj - 1])) return limpar(linhas[iCnpj - 1]);
    const primeira = linhas.find((l) => /[a-zà-ú]{3,}/i.test(l) && !GENERICAS.test(l) && l.length < 60);
    if (primeira) return limpar(primeira);
    return nomeArquivo.replace(/\.[a-z0-9]+$/i, '').replace(/[_\-]+/g, ' ');
  }

  const limpar = (s) => s.replace(/\s{2,}/g, ' ').replace(/\b(ltda|me|eireli|s\.?a\.?|epp)\b\.?/gi, '').trim()
    .toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()).slice(0, 60);

  function acharItens(linhas) {
    return linhas
      .filter((l) => /[a-z]{3,}.*\s\d+,\d{2}$/i.test(l) && !/total|troco|desconto|pagar|tribut|valor/i.test(l))
      .slice(0, 12)
      .map((l) => { const m = l.match(/^(.*?)\s+(?:R\$\s*)?([\d.]+,\d{2})$/); return m ? { nome: m[1].trim(), valor: U.parseValor(m[2]) } : null; })
      .filter(Boolean);
  }

  function extrair(texto, nomeArquivo = '') {
    O.status('extrator', 'trabalhando');
    const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const boleto = lerBoleto(texto);
    const val = acharValor(linhas);
    const datas = datasNoTexto(texto);
    const vencimento = (boleto && boleto.vencimento) || dataRotulada(linhas, /vencimento|vence em|pagar at[eé]/i);
    const data = dataRotulada(linhas, /emiss[aã]o|data da compra|data do pagamento|realizad[oa] em|data\s*:/i) || (datas[0] && datas[0].iso) || '';
    const cnpj = (texto.match(RE_CNPJ) || [''])[0];
    const estabelecimento = acharEstabelecimento(linhas, nomeArquivo);
    const n = U.normalizar(texto);
    const forma = boleto ? 'boleto' : /\bpix\b/.test(n) ? 'pix' : /cr[eé]dito|debito|cartao|visa|master|elo\b/.test(n) ? 'cartao' : /dinheiro/.test(n) ? 'dinheiro' : 'pix';
    const docTipo = boleto ? 'Boleto' : /nfc-?e|danfe|nota fiscal|cupom fiscal/.test(n) ? 'Nota fiscal' : /\bpix\b/.test(n) ? 'Comprovante Pix' : /fatura/.test(n) ? 'Fatura' : /recibo/.test(n) ? 'Recibo' : 'Documento';
    const valor = (boleto && boleto.valor) || val.valor;

    let confianca = 0.2;
    if (valor) confianca += val.como === 'rótulo' || boleto ? 0.35 : 0.15;
    if (data || vencimento) confianca += 0.2;
    if (cnpj || boleto) confianca += 0.15;
    if (estabelecimento) confianca += 0.1;

    const jaPago = ['Nota fiscal', 'Comprovante Pix', 'Recibo'].includes(docTipo);
    const r = {
      status: jaPago ? 'pago' : 'pendente',
      pagoEm: jaPago ? (data || U.hoje()) : '',
      descricao: estabelecimento,
      estabelecimento,
      cnpj,
      valor: Math.round(valor * 100) / 100,
      data: data || vencimento || U.hoje(),
      vencimento: vencimento || data || U.hoje(),
      linhaDigitavel: boleto ? boleto.linha : '',
      forma,
      docTipo,
      itens: acharItens(linhas),
      confiancaExtracao: Math.min(1, confianca),
      texto: texto.slice(0, 4000),
      origem: 'importado',
    };
    O.status('extrator', 'ocioso');
    O.log('extrator', `${docTipo} de ${estabelecimento || '?'}: ${U.moeda(r.valor)}${vencimento ? ', vence ' + U.dataBR(vencimento) : ''} (valor por ${boleto ? 'linha digitável' : val.como || '—'}).`);
    return r;
  }

  /* ---------------- extratos CSV / OFX ---------------- */
  function parseCSV(txt) {
    const prim = txt.split(/\r?\n/)[0] || '';
    const sep = [';', '\t', ','].sort((a, b) => prim.split(b).length - prim.split(a).length)[0];
    const linhas = [];
    let campo = '', linha = [], aspas = false;
    for (let i = 0; i < txt.length; i++) {
      const c = txt[i];
      if (aspas) {
        if (c === '"' && txt[i + 1] === '"') { campo += '"'; i++; } else if (c === '"') aspas = false; else campo += c;
      } else if (c === '"') aspas = true;
      else if (c === sep) { linha.push(campo); campo = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && txt[i + 1] === '\n') i++;
        linha.push(campo); campo = '';
        if (linha.some((x) => x.trim())) linhas.push(linha);
        linha = [];
      } else campo += c;
    }
    linha.push(campo);
    if (linha.some((x) => x.trim())) linhas.push(linha);
    return linhas;
  }

  function dataFlex(s) {
    s = (s || '').trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
    if (m) return paraISO(+m[1], +m[2], m[3]);
    m = s.match(/^(\d{4})(\d{2})(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    return '';
  }

  function extrairExtrato(lido) {
    O.status('extrator', 'trabalhando');
    let itens = [];
    if (lido.tipo === 'ofx') {
      const blocos = lido.texto.split(/<STMTTRN>/i).slice(1);
      const tag = (b, t) => ((b.match(new RegExp(`<${t}>([^<\\r\\n]*)`, 'i')) || [])[1] || '').trim();
      itens = blocos.map((b) => ({ data: dataFlex(tag(b, 'DTPOSTED')), valor: parseFloat(tag(b, 'TRNAMT').replace(',', '.')), descricao: tag(b, 'MEMO') || tag(b, 'NAME') }));
    } else {
      const linhas = parseCSV(lido.texto);
      const iCab = linhas.findIndex((l) => l.some((c) => /data|date/i.test(c)));
      const cab = (linhas[iCab] || []).map((c) => U.normalizar(c));
      const col = (re) => cab.findIndex((c) => re.test(c));
      const cData = col(/data|date/);
      const cDesc = col(/descri|hist|lancamento|estabelecimento|title|memo|detalhe/);
      const cValor = col(/^valor|amount|quantia|valor \(r\$\)/);
      const cCred = col(/credito|entrada/);
      const cDeb = col(/debito|saida/);
      itens = linhas.slice(iCab + 1).map((l) => {
        let valor;
        if (cValor >= 0) valor = U.parseValor(l[cValor]);
        else valor = U.parseValor(l[cCred]) - Math.abs(U.parseValor(l[cDeb]));
        return { data: dataFlex(l[cData]), descricao: (l[cDesc] || '').trim(), valor };
      });
    }
    itens = itens.filter((i) => i.data && i.valor && !/saldo/i.test(i.descricao));
    const temNegativo = itens.some((i) => i.valor < 0);
    const rascunhos = itens.map((i) => ({
      tipo: temNegativo && i.valor > 0 ? 'receita' : 'despesa',
      descricao: i.descricao.replace(/\s{2,}/g, ' ').slice(0, 80) || 'Sem descrição',
      estabelecimento: i.descricao,
      valor: Math.abs(i.valor),
      data: i.data,
      vencimento: i.data,
      status: 'pago',
      pagoEm: i.data,
      forma: /pix/i.test(i.descricao) ? 'pix' : lido.tipo === 'ofx' ? 'debito' : 'cartao',
      docTipo: lido.tipo === 'ofx' ? 'Extrato OFX' : 'Extrato CSV',
      origem: 'importado',
      confiancaExtracao: 0.9,
    }));
    O.status('extrator', 'ocioso');
    O.log('extrator', `Extrato "${lido.nome}": ${rascunhos.length} movimentações encontradas${temNegativo ? '' : ' (tratadas como despesas de cartão)'}.`);
    return rascunhos;
  }

  /* ---------------- extrato bancário em PDF ---------------- */
  const MES_ABREV = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
  const RE_DATA_CAB = /^(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*\.?\s+(\d{4})\b\s*(.*)$/i;
  const RE_DATA_NUM = /^(\d{2})\/(\d{2})(?:\/(\d{2,4}))?\s+(.*)$/;
  const RE_VALOR_FIM = /(-?\s?)(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})\s*$/;
  const RODAPE = /^(tem alguma d[uú]vida|metropolitanas|caso a solu|dispon[ií]veis em|extrato gerado|cpf\b|ag[eê]ncia \d+ conta|valores em r\$|\d+ de \d+$|o saldo l[ií]quido|n[aã]o nos responsabilizamos|asseguramos|cnpj:|movimenta[cç][oõ]es$|saldo (inicial|final|do dia|anterior|em conta)|rendimento l[ií]quido|total de (entradas|sa[ií]das)\s*[+-]?\s*[\d.,]*$)/i;
  const INTERNO = /^(resgate|aplica[cç][aã]o)\s+(rdb|cdb|lci|lca|poupan[cç]a|caixinha)|dinheiro guardado|guardou|resgatou|caixinha|porquinho|cofrinho/i;
  const PREFIXOS = [
    [/^compra no d[eé]bito( via \w+)?\s+/i, 'debito', 'despesa'],
    [/^compra no cr[eé]dito\s+/i, 'cartao', 'despesa'],
    [/^transfer[eê]ncia enviada pelo pix\s+/i, 'pix', 'despesa'],
    [/^pix enviado( para)?\s+/i, 'pix', 'despesa'],
    [/^transfer[eê]ncia recebida( pelo pix)?\s+/i, 'pix', 'receita'],
    [/^pix recebido( de)?\s+/i, 'pix', 'receita'],
    [/^reembolso recebido( pelo pix)?\s+/i, 'pix', 'receita'],
    [/^pagamento de boleto( efetuado)?\s*/i, 'boleto', 'despesa'],
    [/^pagamento de fatura\s*/i, 'debito', 'despesa'],
  ];

  /* Extrato tem várias datas, cada uma com movimentações e valor no fim da linha. */
  function pareceExtrato(texto) {
    const linhas = texto.split('\n');
    const datas = linhas.filter((l) => RE_DATA_CAB.test(l.trim()) || RE_DATA_NUM.test(l.trim())).length;
    const comValor = linhas.filter((l) => RE_VALOR_FIM.test(l.trim())).length;
    return datas >= 3 && comValor >= 6 && /extrato|movimenta[cç]|total de (entradas|sa[ií]das)|saldo/i.test(texto);
  }

  const titulo = (s) => s.toLowerCase().replace(/(^|[\s(/-])\S/g, (c) => c.toUpperCase());

  function nomeLimpo(s) {
    let n = s
      .replace(/\s+-\s*$/, '')
      .replace(/\s+-\s+(•|\*|\d{2,3}\.).*$/, '') // corta CPF mascarado / CNPJ e o banco que vêm depois
      .replace(/\s+-\s+.*$/, '')
      .replace(/\s*\((transfer[eê]ncia|pix).*$/i, '')
      .replace(/^[\d.\/-]+\s+/, '') // CNPJ de MEI grudado no começo
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (n === n.toUpperCase()) n = titulo(n);
    return n.slice(0, 70);
  }

  function extrairExtratoPDF(texto, nomeArquivo) {
    O.status('extrator', 'trabalhando');
    const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const titular = U.normalizar(linhas[0] || '');
    const repetidas = new Set(linhas.slice(0, 4).map((l) => l)); // cabeçalho que se repete em cada página
    const inicio = Math.max(0, linhas.findIndex((l) => /^movimenta[cç][oõ]es/i.test(l)));
    let data = '', sinal = null;
    const itens = [];
    let atual = null;

    for (const l of linhas.slice(inicio)) {
      if (repetidas.has(l)) { atual = null; continue; }
      let resto = l;
      let m = l.match(RE_DATA_CAB);
      if (m) {
        data = paraISO(+m[1], MES_ABREV[m[2].toLowerCase().slice(0, 3)], m[3]);
        resto = m[4];
        atual = null;
      } else if ((m = l.match(RE_DATA_NUM)) && RE_VALOR_FIM.test(l)) {
        data = paraISO(+m[1], +m[2], m[3] || new Date().getFullYear());
        resto = m[4];
      }
      if (/^total de entradas/i.test(resto)) { sinal = 'receita'; atual = null; continue; }
      if (/^total de sa[ií]das/i.test(resto)) { sinal = 'despesa'; atual = null; continue; }
      if (!resto || RODAPE.test(resto)) { if (RODAPE.test(resto)) atual = null; continue; }

      const v = resto.match(RE_VALOR_FIM);
      if (v && data) {
        const bruto = resto.slice(0, v.index).trim();
        let forma = 'pix', tipo = sinal || (v[1].includes('-') ? 'despesa' : 'receita'), nome = bruto;
        for (const [re, f, t] of PREFIXOS) {
          if (re.test(bruto)) { nome = bruto.replace(re, ''); forma = f; if (!sinal) tipo = t; break; }
        }
        const interno = INTERNO.test(bruto) || (titular.length > 8 && U.normalizar(nome).startsWith(titular));
        atual = {
          data, tipo, forma, interno, bruto,
          descricao: interno ? bruto.replace(/\s+-\s+.*$/, '') : (nomeLimpo(nome) || bruto),
          valor: U.parseValor(v[2]),
        };
        itens.push(atual);
      }
      // linhas sem valor no fim são continuação (banco, agência, CNPJ) e ficam de fora
    }

    const rascunhos = itens.filter((i) => i.valor > 0).map((i) => ({
      tipo: i.tipo,
      descricao: i.descricao,
      estabelecimento: i.descricao,
      valor: i.valor,
      data: i.data,
      vencimento: i.data,
      status: 'pago',
      pagoEm: i.data,
      forma: i.forma,
      docTipo: 'Extrato PDF',
      origem: 'importado',
      interno: i.interno,
      notas: i.bruto,
      texto: i.bruto, // a linha original ("Reembolso recebido…", "Compra no débito…") também dá pistas ao Classificador
      confiancaExtracao: 0.9,
    }));
    const n = (t) => rascunhos.filter((r) => r.tipo === t && !r.interno);
    const soma = (ls) => ls.reduce((s, r) => s + r.valor, 0);
    O.status('extrator', 'ocioso');
    O.log('extrator', `Extrato "${nomeArquivo}": ${rascunhos.length} movimentações — ${n('receita').length} entradas (${U.moeda(soma(n('receita')))}), ${n('despesa').length} saídas (${U.moeda(soma(n('despesa')))}) e ${rascunhos.filter((r) => r.interno).length} movimentações internas (aplicação/resgate), deixadas de fora.`);
    return rascunhos;
  }

  return { extrair, extrairExtrato, extrairExtratoPDF, pareceExtrato, lerBoleto };
})();
