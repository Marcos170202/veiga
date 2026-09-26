/* Página pública — Veiga Projetos Estruturais */
'use strict';

// Usado se a página for publicada sem o servidor local (dados institucionais apenas)
const PADRAO = {
  nome: 'Veiga Projetos Estruturais', lema: 'Christus Angularis',
  cnpj: '68.149.546/0001-42', responsavel: 'Eng. Marcos Eduardo de Souza Veiga',
  telefone: '+55 62 99114-7338', email: 'marcos.eduardo108@gmail.com',
  endereco: 'Rua dos Karajás, 152 – Quilombo', cidade: 'Cuiabá – MT', cep: '78045-150',
  quemSomos: 'A Veiga Projetos Estruturais desenvolve projetos de estruturas com rigor técnico, clareza de documentação e acompanhamento próximo de cada cliente.',
  servicos: ['Projetos estruturais em concreto armado', 'Estruturas metálicas e pré-moldadas', 'Fundações e contenções', 'Reforço e recuperação estrutural', 'Laudos, inspeções e pareceres técnicos', 'Compatibilização e modelagem BIM (IFC)'],
};
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let E = PADRAO, temServidor = false;

function linkWhats(texto) {
  let n = (E.telefone || '').replace(/\D/g, '');
  if (!n.startsWith('55') || n.length < 12) n = '55' + n;
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
}

function preencher() {
  $('#quem-somos').textContent = E.quemSomos;
  $('#lema').textContent = E.lema;
  $$('[data-campo]').forEach(el => {
    const k = el.dataset.campo;
    el.textContent = k === 'cidade' ? `${E.cidade} · CEP ${E.cep}` : (E[k] || '');
  });
  $('#link-email').href = 'mailto:' + E.email + '?subject=' + encodeURIComponent('Orçamento de projeto estrutural');
  $$('[data-whats]').forEach(a => (a.href = linkWhats('Olá! Vim pelo site da Veiga Projetos Estruturais e gostaria de um orçamento.')));
  $('#servicos-lista').innerHTML = (E.servicos || []).map((s, i) =>
    `<div class="servico revelar" style="--d:${(i % 3) * 0.1}s"><div class="ic"><svg><use href="#s${i % 6}"/></svg></div><h3>${esc(s)}</h3></div>`).join('');
  $('#tipo').insertAdjacentHTML('beforeend', [...(E.servicos || []), 'Outro'].map(s => `<option>${esc(s)}</option>`).join(''));
  observarRevelar();
}

/* ---------- animações */
function tituloAnimado() {
  const h = $('[data-titulo]');
  const palavras = h.textContent.trim().split(/\s+/);
  h.innerHTML = palavras.map((p, i) =>
    `<span class="palavra${i === palavras.length - 1 ? ' destaque' : ''}"><span style="--i:${i}">${esc(p)}</span></span>`).join(' ');
}
let observador;
function observarRevelar() {
  if (!('IntersectionObserver' in window)) { $$('.revelar').forEach(e => e.classList.add('visivel')); return; }
  observador ||= new IntersectionObserver(ents => ents.forEach(en => {
    if (en.isIntersecting) { en.target.classList.add('visivel'); observador.unobserve(en.target); }
  }), { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  $$('.revelar:not(.visivel)').forEach(e => observador.observe(e));
}
function inclinarBrasao() {
  const hero = $('.hero'), alvo = $('#tilt');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || matchMedia('(hover: none)').matches) return;
  hero.addEventListener('mousemove', e => {
    const r = hero.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    alvo.style.transform = `perspective(900px) rotateY(${x * 16}deg) rotateX(${-y * 12}deg)`;
  });
  hero.addEventListener('mouseleave', () => (alvo.style.transform = ''));
}
function aoRolar() {
  $('#cab').classList.toggle('solido', scrollY > 40);
  const et = $('#etapas'), r = et.getBoundingClientRect();
  const p = Math.min(1, Math.max(0, (innerHeight * 0.8 - r.top) / (r.height + innerHeight * 0.3)));
  et.style.setProperty('--progresso', p.toFixed(3));
  let atual = '';
  $$('section[id]').forEach(s => { if (s.getBoundingClientRect().top < 140) atual = s.id; });
  $$('.cab-nav a:not(.bt)').forEach(a => a.classList.toggle('ativo', a.getAttribute('href') === '#' + atual));
}

/* ---------- menu móvel */
$('#cab-menu').addEventListener('click', () => { $('#cab-menu').classList.toggle('aberto'); $('#cab-nav').classList.toggle('aberta'); });
$$('#cab-nav a').forEach(a => a.addEventListener('click', () => { $('#cab-menu').classList.remove('aberto'); $('#cab-nav').classList.remove('aberta'); }));

/* ---------- formulário */
const arquivos = [];
function listarAnexos() {
  $('#lista-anexos').innerHTML = arquivos.map((f, i) =>
    `<span>${esc(f.name)} <small>${(f.size / 1048576).toFixed(1).replace('.', ',')} MB</small><button type="button" data-rem="${i}" aria-label="Remover">×</button></span>`).join('');
}
function adicionar(lista) {
  for (const f of lista) if (f.size <= 100 * 1048576 && arquivos.length < 20) arquivos.push(f);
  listarAnexos();
}
const zona = $('#soltar');
zona.addEventListener('dragover', e => { e.preventDefault(); zona.classList.add('sobre'); });
zona.addEventListener('dragleave', () => zona.classList.remove('sobre'));
zona.addEventListener('drop', e => { e.preventDefault(); zona.classList.remove('sobre'); adicionar(e.dataTransfer.files); });
$('#anexos').addEventListener('change', e => { adicionar(e.target.files); e.target.value = ''; });
$('#lista-anexos').addEventListener('click', e => { const b = e.target.closest('[data-rem]'); if (b) { arquivos.splice(+b.dataset.rem, 1); listarAnexos(); } });
$$('.flutua select').forEach(s => s.addEventListener('change', () => s.parentElement.classList.toggle('cheio', !!s.value)));
$('#form').addEventListener('input', e => e.target.closest('.flutua')?.classList.remove('invalido'));

function resumo(d) {
  return [`Olá! Solicitei um orçamento pelo site da Veiga Projetos Estruturais.`, ``,
    `Nome: ${d.nome}${d.empresa ? ' (' + d.empresa + ')' : ''}`,
    d.tipo && `Tipo: ${d.tipo}`, d.cidade && `Cidade: ${d.cidade}`, d.area && `Área: ${d.area} m²`, d.prazo && `Prazo: ${d.prazo}`,
    ``, d.mensagem].filter(x => x !== undefined && x !== '').join('\n');
}
function enviarArquivo(id, f, aoProgresso) {
  return new Promise((ok, falha) => {
    const x = new XMLHttpRequest();
    x.open('PUT', `/api/solicitacao-anexo?id=${encodeURIComponent(id)}&nome=${encodeURIComponent(f.name)}`);
    x.upload.onprogress = e => e.lengthComputable && aoProgresso(e.loaded / e.total);
    x.onload = () => (x.status === 200 ? ok() : falha(new Error('anexo')));
    x.onerror = () => falha(new Error('rede'));
    x.send(f);
  });
}
$('#form').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target, d = Object.fromEntries(new FormData(form));
  const erros = [];
  const marcar = n => { form.elements[n].closest('.flutua')?.classList.add('invalido'); };
  if (!d.nome?.trim()) { erros.push('nome'); marcar('nome'); }
  if (!d.telefone?.trim() && !d.email?.trim()) { erros.push('WhatsApp ou e-mail'); marcar('telefone'); }
  if (!d.mensagem?.trim()) { erros.push('descrição da obra'); marcar('mensagem'); }
  if (!d.aceite) erros.push('autorização de contato');
  $('#erro').textContent = erros.length ? 'Falta preencher: ' + erros.join(', ') + '.' : '';
  if (erros.length) return;
  delete d.aceite;

  const bt = $('#enviar'), barra = $('#barra-envio');
  bt.classList.add('enviando'); bt.firstElementChild.textContent = 'Enviando…';
  try {
    if (!temServidor) throw new Error('sem servidor');
    const r = await fetch('/api/solicitacao', { method: 'POST', body: JSON.stringify(d), signal: AbortSignal.timeout(20000) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.erro || 'erro');
    const total = arquivos.reduce((s, f) => s + f.size, 0) || 1;
    let enviado = 0;
    for (const f of arquivos) {
      await enviarArquivo(j.id, f, p => (barra.style.width = ((enviado + p * f.size) / total * 100) + '%'));
      enviado += f.size;
    }
    barra.style.width = '100%';
    concluir(d);
  } catch (err) {
    // sem servidor (página publicada) ou falha: segue pelo WhatsApp com o resumo
    concluir(d);
    if (err.message !== 'anexo') window.open(linkWhats(resumo(d)), '_blank', 'noopener');
  }
});
function concluir(d) {
  $('#form-corpo').hidden = true;
  $('#suc-nome').textContent = d.nome.split(' ')[0];
  $('[data-whats-resumo]').href = linkWhats(resumo(d));
  const em = $('#email-resumo');
  if (em) em.href = `mailto:${E.email}?subject=${encodeURIComponent('Orçamento de projeto estrutural — ' + d.nome)}&body=${encodeURIComponent(resumo(d))}`;
  $('#sucesso').hidden = false;
}

/* ---------- início */
tituloAnimado();
inclinarBrasao();
addEventListener('scroll', aoRolar, { passive: true });
aoRolar();
async function carregarEmpresa() {
  // 1) servidor local (painel rodando)  2) empresa.json da versão publicada  3) dados padrão
  try { const r = await fetch('/api/publico'); if (r.ok) { const j = await r.json(); temServidor = true; return j.empresa; } } catch { /* sem servidor */ }
  try { const r = await fetch('empresa.json'); if (r.ok) return await r.json(); } catch { /* sem arquivo */ }
  return {};
}
carregarEmpresa().then(emp => {
  E = { ...PADRAO, ...emp };
  if (!temServidor) modoPublicado();
  preencher();
});

// Página publicada: sem servidor para receber anexos -> o pedido segue pelo WhatsApp/e-mail
function modoPublicado() {
  $('#soltar').hidden = true;
  $('#soltar').insertAdjacentHTML('afterend', '<p class="nota-anexos">Tem arquitetura, fotos ou sondagem? Depois de enviar, mande os arquivos pelo WhatsApp ou e-mail — isso agiliza o orçamento.</p>');
  $('#enviar span').textContent = 'Enviar pelo WhatsApp';
  $('#sucesso p').innerHTML = 'Obrigado, <b id="suc-nome"></b>! Abrimos o WhatsApp com o seu pedido — é só tocar em enviar. Se preferir, mande por e-mail:';
  $('[data-whats-resumo]').insertAdjacentHTML('afterend', ' <a class="bt bt-vazado" id="email-resumo" href="#">E-mail</a>');
}
