/* Junta index.html + CSS + JS num único arquivo (previa.html) para abrir/enviar facilmente.
   Uso: node tools/montar-previa.js */
const fs = require('fs');
const path = require('path');
const raiz = path.join(__dirname, '..');
let html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, f) => `<style>\n${fs.readFileSync(path.join(raiz, f), 'utf8')}\n</style>`);
html = html.replace(/<script src="(js\/[^"]+)"><\/script>/g, (_, f) => `<script>\n${fs.readFileSync(path.join(raiz, f), 'utf8').replace(/<\/script/gi, '<\\/script')}\n</script>`);
fs.writeFileSync(path.join(raiz, 'previa.html'), html);
console.log('previa.html gerado:', (html.length / 1024).toFixed(0), 'KB');
