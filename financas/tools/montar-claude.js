/* Monta a versão para publicar no claude.ai (Artifact): um arquivo só, sem <html>/<head>/<body>
   (o claude.ai coloca o esqueleto), com CSS e JS embutidos. O pdf.js vai junto como arquivo.
   Uso: node tools/montar-claude.js  →  dist-claude/index.html + dist-claude/vendor/ */
const fs = require('fs');
const path = require('path');
const raiz = path.join(__dirname, '..');
const saida = path.join(raiz, 'dist-claude');
fs.mkdirSync(path.join(saida, 'vendor'), { recursive: true });

const html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];

const titulo = head.match(/<title>[\s\S]*?<\/title>/)[0];
const fontes = (head.match(/<link [^>]*fonts\.googleapis\.com\/css2[^>]*>/) || [''])[0];
const preconnect = (head.match(/<link rel="preconnect"[^>]*>/g) || []).join('\n');
const css = fs.readFileSync(path.join(raiz, 'css/app.css'), 'utf8');

const corpo = body.replace(/<script src="(js\/[^"]+)"><\/script>/g, (_, f) =>
  `<script>\n${fs.readFileSync(path.join(raiz, f), 'utf8').replace(/<\/script/gi, '<\\/script')}\n</script>`);

const pagina = `${titulo}\n${preconnect}\n${fontes}\n<style>\n${css}\n</style>\n${corpo.trim()}\n`;
fs.writeFileSync(path.join(saida, 'index.html'), pagina);
for (const f of ['pdf.min.js', 'pdf.worker.min.js', 'LICENSE-pdfjs.txt']) fs.copyFileSync(path.join(raiz, 'vendor', f), path.join(saida, 'vendor', f));
console.log('dist-claude/index.html:', (pagina.length / 1024).toFixed(0), 'KB');
