/* Estado do app, persistido no navegador (localStorage). Nada sai do seu computador. */
FC.store = (() => {
  const CHAVE = 'controle-financeiro:v1';

  const CATEGORIAS_PADRAO = [
    ['moradia', 'Moradia', 'essenciais', 3200],
    ['contas', 'Contas da casa', 'essenciais', 650],
    ['mercado', 'Mercado', 'essenciais', 1500],
    ['transporte', 'Transporte', 'essenciais', 700],
    ['saude', 'Saúde', 'essenciais', 450],
    ['educacao', 'Educação', 'essenciais', 300],
    ['restaurantes', 'Restaurantes e delivery', 'pessoal', 650],
    ['lazer', 'Lazer', 'pessoal', 400],
    ['assinaturas', 'Assinaturas', 'pessoal', 150],
    ['vestuario', 'Roupas e cuidados', 'pessoal', 350],
    ['pets', 'Pets', 'pessoal', 200],
    ['presentes', 'Presentes', 'pessoal', 150],
    ['impostos', 'Impostos e taxas', 'essenciais', 0],
    ['cartao', 'Fatura do cartão', 'pessoal', 0],
    ['pessoas', 'Pix para pessoas', 'pessoal', 0],
    ['doacoes', 'Doações e dízimo', 'pessoal', 0],
    ['outros', 'Outros', 'pessoal', 200],
    ['casamento', 'Casamento', 'metas', 4500],
    ['investimentos', 'Investimentos', 'metas', 0],
    ['salario', 'Salário', 'receita', 0],
    ['extra', 'Renda extra', 'receita', 0],
    ['reembolso', 'Reembolsos', 'receita', 0],
    ['recebidos', 'Transferências recebidas', 'receita', 0],
  ].map(([id, nome, grupo, orcamento]) => ({ id, nome, grupo, orcamento }));

  function configPadrao() {
    return {
      pessoas: { a: 'Marcos', b: 'Noiva' },
      divisao: { modo: 'proporcional', pctA: 50 },
      alocacao: { essenciais: 50, pessoal: 20, reserva: 15, metas: 15 },
      reservaMeses: 6,
      ocr: false,
      ia: { apiKey: '', modelo: 'claude-opus-5-5', sempre: false },
    };
  }

  function vazio() {
    return {
      versao: 2,
      demo: false,
      config: configPadrao(),
      categorias: JSON.parse(JSON.stringify(CATEGORIAS_PADRAO)),
      lancamentos: [],
      metas: [
        { id: 'reserva', nome: 'Reserva de emergência', alvo: 0, guardado: 0, prazo: '', especial: true },
      ],
      regras: [],
      diario: [],
    };
  }

  /* ---------- dados de exemplo (gerados em torno do mês atual) ---------- */
  function demo() {
    const st = vazio();
    st.demo = true;
    const U = FC.util;
    const hoje = U.hoje();
    const mesAtual = U.mesDe(hoje);
    let semente = 7;
    const rnd = () => { semente = (semente * 9301 + 49297) % 233280; return semente / 233280; };
    const varia = (base, amp) => Math.round((base + (rnd() - 0.5) * 2 * amp) * 100) / 100;
    const L = [];

    const add = (o) => {
      const venc = o.vencimento || o.data;
      const passou = venc < hoje;
      L.push(Object.assign({
        id: U.uid(), tipo: 'despesa', conta: 'casal', pagoPor: 'a',
        status: passou ? 'pago' : 'pendente', pagoEm: passou ? venc : '',
        forma: 'pix', recorrente: false, origem: 'manual', notas: '',
      }, o, { vencimento: venc }));
    };

    for (let i = -11; i <= 0; i++) {
      const ym = U.somaMes(mesAtual, i);
      const d = (dia) => `${ym}-${String(dia).padStart(2, '0')}`;
      const alterna = i % 2 === 0 ? 'a' : 'b';

      add({ tipo: 'receita', descricao: 'Salário', valor: i > -5 ? 8200 : 7800, data: d(5), categoriaId: 'salario', conta: 'a', pagoPor: 'a', recorrente: true });
      add({ tipo: 'receita', descricao: 'Salário', valor: 6400, data: d(5), categoriaId: 'salario', conta: 'b', pagoPor: 'b', recorrente: true });
      if (i % 3 === 0) add({ tipo: 'receita', descricao: 'Freela — projeto site', valor: varia(1400, 500), data: d(22), categoriaId: 'extra', conta: 'a', pagoPor: 'a' });

      add({ descricao: 'Aluguel apartamento', valor: 2650, data: d(10), categoriaId: 'moradia', pagoPor: 'a', recorrente: true, forma: 'boleto' });
      add({ descricao: 'Condomínio', valor: 520, data: d(10), categoriaId: 'moradia', pagoPor: 'b', recorrente: true, forma: 'boleto' });
      add({ descricao: 'Enel — energia', valor: varia(225, 50), data: d(15), categoriaId: 'contas', pagoPor: alterna, forma: 'boleto' });
      add({ descricao: 'Sabesp — água', valor: varia(92, 15), data: d(18), categoriaId: 'contas', pagoPor: 'b', forma: 'boleto' });
      add({ descricao: 'Vivo Fibra', valor: 129.9, data: d(20), categoriaId: 'contas', pagoPor: 'a', recorrente: true, forma: 'cartao' });
      add({ descricao: 'Carrefour', valor: varia(640, 140), data: d(7), categoriaId: 'mercado', pagoPor: 'a', forma: 'cartao' });
      add({ descricao: 'Assaí Atacadista', valor: varia(480, 120), data: d(21), categoriaId: 'mercado', pagoPor: 'b', forma: 'cartao' });
      add({ descricao: 'Hortifruti', valor: varia(150, 40), data: d(14), categoriaId: 'mercado', pagoPor: alterna, forma: 'pix' });
      add({ descricao: 'iFood', valor: varia(190, 70), data: d(12), categoriaId: 'restaurantes', pagoPor: alterna, forma: 'cartao' });
      add({ descricao: 'Jantar — Coco Bambu', valor: varia(260, 80), data: d(25), categoriaId: 'restaurantes', pagoPor: 'a', forma: 'cartao' });
      add({ descricao: 'Netflix', valor: 55.9, data: d(12), categoriaId: 'assinaturas', conta: 'b', pagoPor: 'b', recorrente: true, forma: 'cartao' });
      add({ descricao: 'Spotify Família', valor: 34.9, data: d(8), categoriaId: 'assinaturas', conta: 'a', pagoPor: 'a', recorrente: true, forma: 'cartao' });
      add({ descricao: 'Smart Fit', valor: 129.9, data: d(6), categoriaId: 'saude', conta: 'a', pagoPor: 'a', recorrente: true, forma: 'cartao' });
      add({ descricao: 'Uber', valor: varia(140, 50), data: d(16), categoriaId: 'transporte', conta: 'a', pagoPor: 'a', forma: 'cartao' });
      add({ descricao: 'Posto Shell', valor: varia(260, 60), data: d(9), categoriaId: 'transporte', conta: 'b', pagoPor: 'b', forma: 'cartao' });
      add({ descricao: 'Drogasil', valor: varia(95, 45), data: d(19), categoriaId: 'saude', conta: 'b', pagoPor: 'b', forma: 'cartao' });
      add({ descricao: 'Curso de inglês', valor: 289, data: d(10), categoriaId: 'educacao', conta: 'b', pagoPor: 'b', recorrente: true, forma: 'boleto' });
      add({ descricao: 'Petz — ração', valor: varia(170, 30), data: d(13), categoriaId: 'pets', pagoPor: alterna, forma: 'cartao' });
      if (i % 2 === 0) add({ descricao: 'Renner', valor: varia(240, 90), data: d(23), categoriaId: 'vestuario', conta: alterna, pagoPor: alterna, forma: 'cartao' });
      if (i % 3 === 1) add({ descricao: 'Cinema + pipoca', valor: varia(110, 25), data: d(17), categoriaId: 'lazer', pagoPor: 'b', forma: 'cartao' });

      add({ descricao: 'Aporte Tesouro Selic (reserva)', valor: 1200, data: d(6), categoriaId: 'investimentos', conta: 'casal', pagoPor: alterna, recorrente: true, forma: 'pix' });

      if (i >= -5) {
        const n = i + 6;
        add({ descricao: `Buffet Villa Jardim — parcela ${n}/12`, valor: 2900, data: d(15), categoriaId: 'casamento', pagoPor: n % 2 ? 'a' : 'b', forma: 'boleto', parcela: { n, total: 12 } });
      }
    }

    // alguns itens marcantes
    const mesPassado = U.somaMes(mesAtual, -1);
    add({ descricao: 'Fotógrafo — sinal', valor: 1800, data: `${U.somaMes(mesAtual, -3)}-04`, categoriaId: 'casamento', pagoPor: 'b', forma: 'pix' });
    add({ descricao: 'Alianças — Vivara', valor: 3400, data: `${U.somaMes(mesAtual, -7)}-11`, categoriaId: 'casamento', pagoPor: 'a', forma: 'cartao' });
    add({ descricao: 'IPTU — parcela 10/10', valor: 312.4, data: `${mesPassado}-28`, categoriaId: 'moradia', pagoPor: 'a', forma: 'boleto' });
    add({ descricao: 'Presente aniversário sogra', valor: 180, data: `${mesPassado}-03`, categoriaId: 'presentes', conta: 'a', pagoPor: 'a', forma: 'pix' });

    // deixa o IPTU do mês passado em aberto para mostrar o alerta de atraso
    const iptu = L.find((l) => l.descricao.startsWith('IPTU'));
    iptu.status = 'pendente'; iptu.pagoEm = '';

    st.lancamentos = L;
    st.metas = [
      { id: 'reserva', nome: 'Reserva de emergência', alvo: 0, guardado: 19800, prazo: '', especial: true },
      { id: U.uid(), nome: 'Casamento', alvo: 48000, guardado: 23500, prazo: '2027-09-18' },
      { id: U.uid(), nome: 'Lua de mel', alvo: 18000, guardado: 4300, prazo: '2027-09-25' },
      { id: U.uid(), nome: 'Entrada do apartamento', alvo: 90000, guardado: 14000, prazo: '2029-12-01' },
    ];
    st.regras = [{ padrao: 'villa jardim', categoriaId: 'casamento' }];
    return st;
  }

  let estado;
  try {
    const bruto = localStorage.getItem(CHAVE);
    estado = bruto ? JSON.parse(bruto) : null;
  } catch (e) { estado = null; }
  // no claude.ai os dados vêm da nuvem: começa vazio em vez de mostrar o exemplo
  if (!estado) estado = FC.util.noClaude ? vazio() : demo();
  // migrações leves: garante campos novos
  estado.config = Object.assign(configPadrao(), estado.config);
  estado.config.ia = Object.assign(configPadrao().ia, estado.config.ia);
  estado.diario = estado.diario || [];
  estado.regras = estado.regras || [];
  if ((estado.versao || 1) < 2) {
    // versão 2: novas categorias padrão (impostos, fatura, Pix para pessoas, doações, transferências recebidas)
    CATEGORIAS_PADRAO.forEach((c) => { if (!estado.categorias.some((x) => x.id === c.id)) estado.categorias.push({ ...c }); });
    estado.versao = 2;
  }

  let timer;
  function salvar(notificar = true) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try { localStorage.setItem(CHAVE, JSON.stringify(estado)); } catch (e) { console.warn('Não foi possível salvar', e); }
    }, 120);
    if (FC.nuvem) FC.nuvem.agendar();
    if (notificar && FC.orquestrador) FC.orquestrador.emitir('mudou');
  }

  function substituir(novo) {
    Object.keys(estado).forEach((k) => delete estado[k]);
    Object.assign(estado, novo);
    salvar();
  }

  return {
    get estado() { return estado; },
    salvar,
    substituir,
    resetarVazio: () => substituir(vazio()),
    resetarDemo: () => substituir(demo()),
    categoria: (id) => estado.categorias.find((c) => c.id === id) || { id: 'outros', nome: 'Outros', grupo: 'pessoal', orcamento: 0 },
    nomeConta(c) {
      const p = estado.config.pessoas;
      return c === 'casal' ? 'Conjunta' : c === 'a' ? p.a : p.b;
    },
  };
})();
