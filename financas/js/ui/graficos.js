/* Gráficos em SVG puro (sem bibliotecas). Paleta validada para daltonismo sobre o fundo bege. */
FC.graficos = (() => {
  const U = FC.util;
  const SERIES = ['#4F8A1F', '#A4448F', '#D08A00', '#2F6FC0', '#C4502A', '#12937F'];
  const NEUTRO = '#D6CCB6';
  const SUPERFICIE = '#FBF8F1';
  const UNICA = '#5E7A3A';

  let tip;
  function tooltip() {
    if (!tip) { tip = document.createElement('div'); tip.className = 'tip'; tip.setAttribute('role', 'status'); document.body.appendChild(tip); }
    return tip;
  }
  /* linhas: [{cor, valor, rotulo}] — valor em destaque, rótulo secundário */
  function mostrarTip(ev, titulo, linhas) {
    const t = tooltip();
    t.replaceChildren();
    if (titulo) { const h = document.createElement('div'); h.className = 'tip-t'; h.textContent = titulo; t.appendChild(h); }
    linhas.forEach((l) => {
      const r = document.createElement('div'); r.className = 'tip-r';
      if (l.cor) { const k = document.createElement('i'); k.style.background = l.cor; r.appendChild(k); }
      const v = document.createElement('b'); v.textContent = l.valor; r.appendChild(v);
      if (l.rotulo) { const s = document.createElement('span'); s.textContent = l.rotulo; r.appendChild(s); }
      t.appendChild(r);
    });
    t.style.opacity = 1;
    const x = ev.clientX ?? (ev.target.getBoundingClientRect().left + 10);
    const y = ev.clientY ?? ev.target.getBoundingClientRect().top;
    const w = t.offsetWidth;
    t.style.left = Math.min(window.innerWidth - w - 8, x + 14) + 'px';
    t.style.top = (y + 14) + 'px';
  }
  function esconderTip() { if (tip) tip.style.opacity = 0; }

  /* ---------- rosca (alocação da renda) ---------- */
  function rosca(el, fatias, centro) {
    const total = fatias.reduce((s, f) => s + f.valor, 0) || 1;
    const R = 78, r = 54, C = 90;
    let ang = -Math.PI / 2;
    const arcos = fatias.filter((f) => f.valor > 0).map((f) => {
      const a = f.valor / total * Math.PI * 2;
      const a0 = ang, a1 = ang + a; ang = a1;
      const larg = a > Math.PI ? 1 : 0;
      const p = (rad, ang2) => `${C + rad * Math.cos(ang2)} ${C + rad * Math.sin(ang2)}`;
      const d = a >= Math.PI * 2 - 0.001
        ? `M ${C - R} ${C} a ${R} ${R} 0 1 0 ${2 * R} 0 a ${R} ${R} 0 1 0 ${-2 * R} 0 M ${C - r} ${C} a ${r} ${r} 0 1 1 ${2 * r} 0 a ${r} ${r} 0 1 1 ${-2 * r} 0`
        : `M ${p(R, a0)} A ${R} ${R} 0 ${larg} 1 ${p(R, a1)} L ${p(r, a1)} A ${r} ${r} 0 ${larg} 0 ${p(r, a0)} Z`;
      return { ...f, d, pct: f.valor / total * 100 };
    });
    el.innerHTML = `
      <div class="rosca">
        <svg viewBox="0 0 180 180" role="img" aria-label="Distribuição da renda">
          ${arcos.map((a, i) => `<path class="fatia" data-i="${i}" d="${a.d}" fill="${a.cor}" stroke="${SUPERFICIE}" stroke-width="2" fill-rule="evenodd" tabindex="0"></path>`).join('')}
          <text x="90" y="86" text-anchor="middle" class="rosca-v">${U.esc(centro.valor)}</text>
          <text x="90" y="104" text-anchor="middle" class="rosca-r">${U.esc(centro.rotulo)}</text>
        </svg>
        <ul class="legenda">
          ${fatias.map((f) => `<li><i style="background:${f.cor}"></i><span>${U.esc(f.nome)}</span><b>${U.pct(f.valor / total * 100)}</b>${f.meta != null ? `<em>meta ${f.meta}%</em>` : ''}</li>`).join('')}
        </ul>
      </div>`;
    el.querySelectorAll('.fatia').forEach((p) => {
      const a = arcos[+p.dataset.i];
      const mostrar = (ev) => mostrarTip(ev, a.nome, [{ cor: a.cor, valor: U.moeda(a.valor), rotulo: `${U.pct(a.pct)} da renda` }]);
      p.addEventListener('pointermove', mostrar); p.addEventListener('focus', mostrar);
      p.addEventListener('pointerleave', esconderTip); p.addEventListener('blur', esconderTip);
    });
  }

  /* ---------- barras horizontais (categorias), com marca do orçamento ---------- */
  function barras(el, itens, { max = 8, mostrarOrcamento = true } = {}) {
    const lista = itens.slice(0, max);
    if (!lista.length) { el.innerHTML = '<p class="vazio">Sem despesas neste período.</p>'; return; }
    const topo = Math.max(...lista.map((i) => Math.max(i.valor, mostrarOrcamento ? i.orcamento || 0 : 0))) || 1;
    el.innerHTML = `<div class="barras">${lista.map((i, k) => {
      const w = i.valor / topo * 100;
      const o = i.orcamento && mostrarOrcamento ? i.orcamento / topo * 100 : null;
      return `<div class="barra-l" data-k="${k}" tabindex="0">
        <span class="barra-n">${U.esc(i.nome)}</span>
        <span class="barra-trilho">
          <span class="barra-f" style="width:${Math.max(w, 0.8)}%;background:${UNICA}"></span>
          ${o != null ? `<span class="barra-o" style="left:${o}%" title="orçamento"></span>` : ''}
        </span>
        <span class="barra-v">${U.moeda(i.valor)}</span>
      </div>`;
    }).join('')}</div>`;
    el.querySelectorAll('.barra-l').forEach((b) => {
      const i = lista[+b.dataset.k];
      const linhas = [{ cor: UNICA, valor: U.moeda(i.valor), rotulo: 'gasto' }];
      if (i.orcamento) linhas.push({ valor: U.moeda(i.orcamento), rotulo: `orçamento · ${Math.round(i.valor / i.orcamento * 100)}% usado` });
      const mostrar = (ev) => mostrarTip(ev, i.nome, linhas);
      b.addEventListener('pointermove', mostrar); b.addEventListener('focus', mostrar);
      b.addEventListener('pointerleave', esconderTip); b.addEventListener('blur', esconderTip);
    });
  }

  /* ---------- linhas (receitas x despesas por mês) com mira e tooltip ---------- */
  function linhas(el, pontos, series) {
    if (!pontos.some((p) => series.some((s) => p[s.chave]))) { el.innerHTML = '<p class="vazio">O gráfico aparece quando houver lançamentos.</p>'; return; }
    const W = Math.max(320, el.clientWidth || 640), H = 240;
    const m = { t: 16, r: 74, b: 28, l: 56 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const maxV = Math.max(...pontos.flatMap((p) => series.map((s) => p[s.chave]))) || 1;
    const passo = Math.pow(10, Math.floor(Math.log10(maxV)));
    const topo = Math.ceil(maxV / passo / 2) * passo * 2 || 1;
    const x = (i) => m.l + (pontos.length === 1 ? iw / 2 : i / (pontos.length - 1) * iw);
    const y = (v) => m.t + ih - v / topo * ih;
    const grades = [0, 0.25, 0.5, 0.75, 1].map((f) => f * topo);

    const caminho = (chave) => pontos.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p[chave]).toFixed(1)}`).join(' ');
    const ult = pontos.length - 1;
    const passoRot = Math.max(1, Math.ceil(pontos.length * 48 / iw)); // evita rótulos de mês encavalados
    // rótulos diretos no fim das linhas, afastados se colidirem
    const fins = series.map((s) => ({ s, y: y(pontos[ult][s.chave]) })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < fins.length; i++) if (fins[i].y - fins[i - 1].y < 14) fins[i].y = fins[i - 1].y + 14;

    el.innerHTML = `
      <ul class="legenda legenda-h">${series.map((s) => `<li><i class="linha-k" style="background:${s.cor}"></i><span>${U.esc(s.nome)}</span></li>`).join('')}</ul>
      <svg class="grafico-linhas" viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="Receitas e despesas por mês">
        ${grades.map((g) => `<line x1="${m.l}" x2="${W - m.r}" y1="${y(g)}" y2="${y(g)}" class="grade"/><text x="${m.l - 8}" y="${y(g) + 4}" text-anchor="end" class="eixo">${U.esc(g ? U.moedaCurta(g).replace(/^R\$\s*/, '') : '0')}</text>`).join('')}
        ${pontos.map((p, i) => ((ult - i) % passoRot === 0) ? `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" class="eixo">${U.esc(U.mesCurto(p.ym))}</text>` : '').join('')}
        ${series.map((s) => `<path d="${caminho(s.chave)}" fill="none" stroke="${s.cor}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" ${s.tracejado ? 'stroke-dasharray="5 4"' : ''}/>`).join('')}
        ${fins.map((f) => `<text x="${x(ult) + 8}" y="${f.y + 4}" class="rotulo-fim">${U.esc(f.s.nome)}</text>`).join('')}
        <line class="mira" y1="${m.t}" y2="${m.t + ih}" x1="-10" x2="-10"/>
        ${series.map((s, k) => `<circle class="ponto" data-s="${k}" r="4.5" cx="-10" cy="-10" fill="${s.cor}" stroke="${SUPERFICIE}" stroke-width="2"/>`).join('')}
        <rect class="alvo" x="${m.l - 10}" y="${m.t}" width="${iw + 20}" height="${ih}" fill="transparent" tabindex="0"/>
      </svg>`;

    const svg = el.querySelector('svg');
    const mira = svg.querySelector('.mira');
    const pts = svg.querySelectorAll('.ponto');
    const alvo = svg.querySelector('.alvo');
    let atual = ult;
    const mover = (i, ev) => {
      atual = i;
      const p = pontos[i];
      mira.setAttribute('x1', x(i)); mira.setAttribute('x2', x(i));
      pts.forEach((c, k) => { c.setAttribute('cx', x(i)); c.setAttribute('cy', y(p[series[k].chave])); });
      mostrarTip(ev, U.mesLabel(p.ym), series.map((s) => ({ cor: s.cor, valor: U.moeda(p[s.chave]), rotulo: s.nome }))
        .concat([{ valor: U.moeda(p.receitas - p.despesas), rotulo: 'saldo' }]));
    };
    alvo.addEventListener('pointermove', (ev) => {
      const r = svg.getBoundingClientRect();
      const px = (ev.clientX - r.left) / r.width * W;
      mover(Math.max(0, Math.min(ult, Math.round((px - m.l) / iw * ult))), ev);
    });
    alvo.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
        ev.preventDefault();
        const r = alvo.getBoundingClientRect();
        mover(Math.max(0, Math.min(ult, atual + (ev.key === 'ArrowLeft' ? -1 : 1))), { clientX: r.left + x(atual) / W * r.width, clientY: r.top + 20 });
      }
    });
    const sair = () => { esconderTip(); mira.setAttribute('x1', -10); mira.setAttribute('x2', -10); pts.forEach((c) => c.setAttribute('cx', -10)); };
    alvo.addEventListener('pointerleave', sair); alvo.addEventListener('blur', sair);
  }

  /* ---------- barra de progresso simples ---------- */
  function progresso(pct, nivel) {
    const cls = nivel || (pct > 100 ? 'critico' : pct >= 90 ? 'atencao' : 'ok');
    return `<span class="prog prog-${cls}"><span style="width:${Math.min(100, Math.max(0, pct))}%"></span></span>`;
  }

  return { SERIES, NEUTRO, rosca, barras, linhas, progresso, mostrarTip, esconderTip };
})();
