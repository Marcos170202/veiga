/* Agente Leitor — abre o arquivo e entrega texto (e o binário, quando a IA precisar). */
FC.agentes.leitor = (() => {
  const O = FC.orquestrador;
  O.registrar({
    id: 'leitor', nome: 'Leitor', papel: 'Abre PDFs, imagens, extratos CSV/OFX e devolve o texto bruto.',
    sigla: 'LE',
  });

  // pdf.js vem junto do app (pasta vendor/); se não estiver lá, usa a CDN
  const PDFJS = ['vendor/pdf.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'];
  const PDFJS_WORKER = ['vendor/pdf.worker.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'];
  const TESSERACT = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';

  function tipoDe(file) {
    const n = file.name.toLowerCase();
    if (file.type === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
    if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|heic)$/.test(n)) return 'imagem';
    if (n.endsWith('.ofx')) return 'ofx';
    if (n.endsWith('.csv')) return 'csv';
    return 'texto';
  }

  async function carregarPrimeiro(fontes) {
    for (let i = 0; i < fontes.length; i++) {
      try { await FC.util.carregarScript(fontes[i]); return i; } catch (e) { /* tenta a próxima */ }
    }
    throw new Error('não consegui carregar o leitor de PDF');
  }

  async function lerTexto(file) {
    const buf = await file.arrayBuffer();
    let txt = new TextDecoder('utf-8').decode(buf);
    if (txt.includes('�')) txt = new TextDecoder('iso-8859-1').decode(buf); // extratos de banco antigos
    return txt;
  }

  async function lerPDF(file) {
    const i = await carregarPrimeiro(PDFJS);
    const lib = window.pdfjsLib;
    lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER[i];
    // abrindo direto do disco (file://) o navegador bloqueia Workers: roda o worker na página
    if (location.protocol === 'file:' && !window.pdfjsWorker) await carregarPrimeiro(PDFJS_WORKER);
    const pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
    const paginas = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const pag = await pdf.getPage(p);
      const conteudo = await pag.getTextContent();
      // reconstrói linhas agrupando itens pela coordenada vertical
      const linhas = new Map();
      conteudo.items.forEach((it) => {
        const y = Math.round(it.transform[5] / 3) * 3;
        if (!linhas.has(y)) linhas.set(y, []);
        linhas.get(y).push({ x: it.transform[4], s: it.str });
      });
      const texto = [...linhas.entries()].sort((a, b) => b[0] - a[0])
        .map(([, itens]) => itens.sort((a, b) => a.x - b.x).map((i) => i.s).join(' ').replace(/\s+/g, ' ').trim())
        .filter(Boolean).join('\n');
      paginas.push(texto);
    }
    return { paginas: pdf.numPages, texto: paginas.join('\n\n') };
  }

  async function ocr(file) {
    O.status('leitor', 'trabalhando');
    O.log('leitor', `Rodando OCR em "${file.name}" (pode levar alguns segundos)…`);
    await FC.util.carregarScript(TESSERACT);
    const r = await window.Tesseract.recognize(file, 'por');
    O.status('leitor', 'ocioso');
    O.log('leitor', `OCR concluído: ${r.data.text.length} caracteres lidos.`);
    return r.data.text;
  }

  async function ler(file) {
    O.status('leitor', 'trabalhando');
    const tipo = tipoDe(file);
    const saida = { nome: file.name, tipo, mime: file.type || (tipo === 'pdf' ? 'application/pdf' : ''), arquivo: file, texto: '' };
    try {
      if (tipo === 'pdf') {
        const r = await lerPDF(file);
        saida.texto = r.texto;
        O.log('leitor', `Li "${file.name}" (${r.paginas} pág., ${r.texto.length} caracteres${r.texto.length < 25 ? ' — parece digitalizado' : ''}).`);
      } else if (tipo === 'imagem') {
        O.log('leitor', `Recebi a imagem "${file.name}".`);
      } else {
        saida.texto = await lerTexto(file);
        O.log('leitor', `Li o arquivo de texto "${file.name}" (${saida.texto.split('\n').length} linhas).`);
      }
    } finally {
      O.status('leitor', 'ocioso');
    }
    return saida;
  }

  return { ler, ocr, tipoDe };
})();
