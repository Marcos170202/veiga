/* Agente Classificador — decide a categoria e aprende com cada correção sua. */
FC.agentes.classificador = (() => {
  const O = FC.orquestrador;
  const U = FC.util;
  O.registrar({
    id: 'classificador', nome: 'Classificador', sigla: 'CL',
    papel: 'Sugere a categoria de cada gasto por palavras-chave e memoriza suas correções.',
  });

  const DICIONARIO = {
    moradia: ['aluguel', 'condominio', 'iptu', 'imobiliaria', 'quintoandar', 'seguro residencial', 'reforma', 'leroy', 'telhanorte', 'tok&stok', 'tok stok', 'etna', 'camicado'],
    contas: ['enel', 'cemig', 'copel', 'light', 'celesc', 'coelba', 'energisa', 'equatorial', 'neoenergia', 'sabesp', 'cedae', 'copasa', 'sanepar', 'embasa', 'comgas', 'naturgy', 'ultragaz', 'liquigas', 'vivo', 'claro', 'tim', 'oi fibra', 'net', 'internet', 'telefone', 'energia', 'eletricidade', 'eletropaulo', 'saneamento', 'agua', 'gas', 'conta de luz'],
    mercado: ['supermercado', 'mercado', 'carrefour', 'assai', 'atacadao', 'pao de acucar', 'extra mercado', 'sonda', 'hirota', 'zaffari', 'guanabara', 'hortifruti', 'sacolao', 'acougue', 'padaria', 'mambo', 'oba hortifruti', 'swift', 'st marche', 'makro', 'sams club', 'atacarejo'],
    transporte: ['uber', '99 ', '99app', 'cabify', 'posto', 'shell', 'ipiranga', 'petrobras', 'br mania', 'combustivel', 'gasolina', 'etanol', 'estacionamento', 'estapar', 'sem parar', 'conectcar', 'veloe', 'pedagio', 'metro', 'onibus', 'bilhete unico', 'ipva', 'licenciamento', 'oficina', 'pneu'],
    saude: ['farmacia', 'drogasil', 'droga raia', 'drogaria', 'pague menos', 'panvel', 'unimed', 'amil', 'sulamerica', 'bradesco saude', 'hapvida', 'hospital', 'clinica', 'laboratorio', 'fleury', 'dasa', 'consulta', 'dentista', 'odonto', 'psicolog', 'smart fit', 'smartfit', 'academia', 'bluefit', 'gympass', 'wellhub'],
    educacao: ['curso', 'escola', 'faculdade', 'universidade', 'udemy', 'alura', 'coursera', 'livraria', 'amazon livros', 'mensalidade', 'ingles', 'idiomas', 'material escolar'],
    restaurantes: ['ifood', 'rappi', 'restaurante', 'lanchonete', 'pizzaria', 'hamburgueria', 'mcdonald', 'burger king', 'bk ', 'outback', 'coco bambu', 'madero', 'starbucks', 'cafe', 'bar ', 'churrascaria', 'sushi', 'aiqfome', 'ze delivery', 'subway', 'habib'],
    lazer: ['cinema', 'cinemark', 'kinoplex', 'ingresso', 'sympla', 'eventim', 'teatro', 'show', 'parque', 'viagem', 'hotel', 'airbnb', 'booking', 'decolar', 'latam', 'gol ', 'azul ', 'steam', 'playstation', 'xbox', 'nintendo'],
    assinaturas: ['netflix', 'spotify', 'disney', 'hbo', 'max ', 'prime video', 'amazon prime', 'globoplay', 'youtube premium', 'deezer', 'apple.com', 'icloud', 'google one', 'paramount', 'crunchyroll', 'chatgpt', 'claude', 'microsoft 365', 'adobe'],
    vestuario: ['renner', 'riachuelo', 'c&a', 'cea ', 'zara', 'hering', 'shein', 'centauro', 'netshoes', 'nike', 'adidas', 'boticario', 'natura', 'sephora', 'salao', 'barbearia', 'cabeleireiro', 'manicure', 'estetica', 'roupa', 'calcado'],
    pets: ['petz', 'cobasi', 'petlove', 'veterinari', 'pet shop', 'petshop', 'racao', 'banho e tosa'],
    presentes: ['presente', 'floricultura', 'flores', 'vivara', 'pandora', 'giuliana flores', 'lojas americanas presente'],
    casamento: ['buffet', 'cerimonial', 'assessoria de casamento', 'fotografo', 'fotografia', 'filmagem', 'vestido de noiva', 'noiva', 'noivo', 'decoracao', 'convite', 'aliancas', 'alianca', 'dj ', 'banda', 'bem casado', 'bolo de casamento', 'igreja', 'cartorio', 'lua de mel', 'espaco de eventos', 'sitio', 'traje'],
    investimentos: ['tesouro', 'cdb', 'lci', 'lca', 'aporte', 'corretora', 'xp invest', 'rico ', 'clear', 'nuinvest', 'btg', 'previdencia', 'poupanca', 'reserva'],
    salario: ['salario', 'folha de pagamento', 'pagamento de salario', 'proventos', 'remuneracao'],
    extra: ['freela', 'freelance', 'venda', 'rendimento', 'dividendos', 'cashback', 'bonus', 'pix recebido'],
    reembolso: ['reembolso', 'estorno', 'devolucao'],
  };

  // o termo precisa começar no início de uma palavra ("gas" não casa com "drogasil")
  // termos curtos precisam ser a palavra inteira ("metro" não casa com "metropolitana")
  const casa = (txt, t) => {
    const i = txt.indexOf(t);
    if (i < 0) return false;
    const antesOk = i === 0 || !/[a-z0-9]/.test(txt[i - 1]);
    const depois = txt[i + t.length];
    const depoisOk = t.trim().length > 5 || !depois || !/[a-z0-9]/.test(depois);
    if (antesOk && depoisOk) return true;
    return casa(txt.slice(i + 1), t);
  };

  function classificar(r) {
    O.status('classificador', 'trabalhando');
    const alvo = U.normalizar(` ${r.descricao || ''} ${r.estabelecimento || ''} ${(r.itens || []).map((i) => i.nome).join(' ')} `);
    const texto = U.normalizar(r.texto || '');
    let resultado = null;

    // 1) memória: regras aprendidas com você têm prioridade
    const regra = FC.store.estado.regras.find((g) => alvo.includes(g.padrao));
    if (regra) resultado = { categoriaId: regra.categoriaId, confianca: 0.97, motivo: `regra aprendida: "${regra.padrao}"` };

    // 2) dicionário: pontua cada categoria; descrição pesa mais que o resto do documento
    if (!resultado) {
      let melhor = { id: null, pontos: 0, termo: '' };
      Object.entries(DICIONARIO).forEach(([id, termos]) => {
        if (!FC.store.estado.categorias.some((c) => c.id === id)) return;
        if ((r.tipo === 'receita') !== ['salario', 'extra', 'reembolso'].includes(id)) return;
        termos.forEach((t) => {
          const p = (casa(alvo, t) ? 3 : 0) + (casa(texto, t) ? 1 : 0);
          if (p > melhor.pontos) melhor = { id, pontos: p, termo: t.trim() };
        });
      });
      // categorias criadas por você: o próprio nome vira palavra-chave
      FC.store.estado.categorias.forEach((c) => {
        const t = U.normalizar(c.nome);
        if (t.length > 3 && casa(alvo, t) && melhor.pontos < 3) melhor = { id: c.id, pontos: 3, termo: t };
      });
      if (melhor.id) resultado = { categoriaId: melhor.id, confianca: melhor.pontos >= 3 ? 0.85 : 0.6, motivo: `palavra-chave "${melhor.termo}"` };
    }

    // 3) sem pistas: usa o histórico do mesmo estabelecimento
    if (!resultado) {
      const chave = U.normalizar(r.descricao).split(' ')[0];
      const igual = chave && FC.store.estado.lancamentos.find((l) => U.normalizar(l.descricao).startsWith(chave));
      resultado = igual
        ? { categoriaId: igual.categoriaId, confianca: 0.55, motivo: `parecido com "${igual.descricao}"` }
        : { categoriaId: r.tipo === 'receita' ? 'extra' : 'outros', confianca: 0.2, motivo: 'sem pistas — revise' };
    }
    O.status('classificador', 'ocioso');
    O.log('classificador', `"${r.descricao}" → ${FC.store.categoria(resultado.categoriaId).nome} (${Math.round(resultado.confianca * 100)}%, ${resultado.motivo}).`);
    return resultado;
  }

  /* Quando você corrige uma categoria, o agente guarda o padrão para a próxima vez. */
  function aprender(descricao, categoriaId) {
    const palavras = U.normalizar(descricao).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((p) => p.length > 2 && !/^\d+$/.test(p));
    const padrao = palavras.slice(0, 2).join(' ');
    if (!padrao) return;
    const st = FC.store.estado;
    const existente = st.regras.find((g) => g.padrao === padrao);
    if (existente) existente.categoriaId = categoriaId; else st.regras.push({ padrao, categoriaId });
    FC.store.salvar(false);
    O.log('classificador', `Aprendi: "${padrao}" agora é ${FC.store.categoria(categoriaId).nome}.`);
  }

  return { classificar, aprender, DICIONARIO };
})();
