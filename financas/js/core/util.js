/* Utilitários compartilhados por todos os agentes e telas */
window.FC = window.FC || {};

FC.util = (() => {
  // aberto como página publicada no claude.ai? (lá existe window.claude.use)
  const noClaude = !!(window.claude && typeof window.claude.use === 'function');
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const num = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
    'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  const pad = (n) => String(n).padStart(2, '0');

  return {
    noClaude,
    MESES, MESES_CURTOS,
    uid: () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    moeda: (v) => brl.format(Number(v) || 0),
    moedaCurta(v) {
      const a = Math.abs(v);
      if (a >= 1e6) return 'R$ ' + num.format(v / 1e6) + ' mi';
      if (a >= 1e3) return 'R$ ' + num.format(v / 1e3) + ' mil';
      return brl.format(v);
    },
    pct: (v) => num.format(v) + '%',
    hoje() {
      const d = new Date();
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    },
    iso(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; },
    parseISO(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); },
    dataBR(s) { if (!s) return '—'; const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; },
    dataCurta(s) { if (!s) return '—'; const [, m, d] = s.split('-'); return `${d} ${MESES_CURTOS[+m - 1]}`; },
    mesDe: (s) => (s || '').slice(0, 7),
    mesLabel(ym) { const [y, m] = ym.split('-'); return `${MESES[+m - 1]} ${y}`; },
    mesCurto(ym) { const [y, m] = ym.split('-'); return `${MESES_CURTOS[+m - 1]}/${y.slice(2)}`; },
    somaMes(ym, delta) {
      const [y, m] = ym.split('-').map(Number);
      const d = new Date(y, m - 1 + delta, 1);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    },
    diasEntre(a, b) { return Math.round((FC.util.parseISO(b) - FC.util.parseISO(a)) / 86400000); },
    somaDias(s, n) { const d = FC.util.parseISO(s); d.setDate(d.getDate() + n); return FC.util.iso(d); },
    /* Ajusta o dia para o mês de destino (ex.: dia 31 em fevereiro vira 28/29) */
    mesmoDiaNoMes(isoData, ym) {
      const dia = +isoData.slice(8, 10);
      const [y, m] = ym.split('-').map(Number);
      const ultimo = new Date(y, m, 0).getDate();
      return `${ym}-${pad(Math.min(dia, ultimo))}`;
    },
    /* "1.234,56" | "1234.56" | "R$ 99,90" → número */
    parseValor(txt) {
      if (typeof txt === 'number') return txt;
      if (!txt) return 0;
      let s = String(txt).replace(/[^\d,.\-]/g, '');
      if (s.includes(',') && s.includes('.')) {
        s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
      } else if (s.includes(',')) {
        s = s.replace(',', '.');
      }
      const v = parseFloat(s);
      return isNaN(v) ? 0 : v;
    },
    normalizar: (s) => (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''),
    esc(s) {
      return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },
    /* Dentro do claude.ai o download passa pela confirmação do próprio Claude. */
    async baixar(nome, conteudo, tipo = 'text/plain') {
      if (FC.util.noClaude) {
        const dl = await window.claude.use('downloads');
        if (!dl) throw new Error('download indisponível nesta visualização');
        await dl.save({ filename: nome, data: conteudo });
        return;
      }
      const blob = conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: tipo });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = nome;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    },
    carregarScript(src) {
      return new Promise((ok, erro) => {
        const ja = document.querySelector(`script[src="${src}"]`);
        if (ja && ja.dataset.carregado) return ok();
        if (ja) ja.remove();
        const s = document.createElement('script');
        s.src = src;
        s.onload = () => { s.dataset.carregado = '1'; ok(); };
        s.onerror = () => { s.remove(); erro(new Error('Falha ao carregar ' + src)); };
        document.head.appendChild(s);
      });
    },
    arquivoParaBase64(file) {
      return new Promise((ok, erro) => {
        const r = new FileReader();
        r.onload = () => ok(String(r.result).split(',')[1]);
        r.onerror = erro;
        r.readAsDataURL(file);
      });
    },
  };
})();
