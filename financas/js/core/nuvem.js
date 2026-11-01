/*
 * Nuvem — quando o app está publicado no claude.ai, os dados ficam guardados lá
 * (banco da própria página), e não só no navegador. Funciona em qualquer aparelho
 * em que você abrir o link, e em tempo real para quem tiver acesso de edição.
 *
 * Organização:  casa/config          → ajustes, categorias, metas, regras, acertos
 *               meses/<AAAA-MM>      → lançamentos daquele mês (um documento por mês)
 */
FC.nuvem = (() => {
  const U = FC.util;
  const st = () => FC.store.estado;
  let db = null;
  let estado = 'local'; // local | conectando | nuvem | offline
  let ultimo = { config: '', meses: {} }; // o que já está gravado lá (JSON), para gravar só o que mudou
  let fila = Promise.resolve();
  let timer = null;
  const ouvintes = [];

  const avisar = () => ouvintes.forEach((f) => { try { f(estado); } catch (e) { /* ignora */ } });

  function partes() {
    const s = st();
    const meses = {};
    s.lancamentos.forEach((l) => { const m = (l.data || '').slice(0, 7) || 'sem-data'; (meses[m] = meses[m] || []).push(l); });
    const config = {
      versao: s.versao, demo: false,
      config: { ...s.config, ia: { ...s.config.ia, apiKey: '' } },
      categorias: s.categorias, metas: s.metas, regras: s.regras, acertos: s.acertos || [],
    };
    return { config, meses };
  }

  function aplicarRemoto(configDoc, mesesDocs) {
    const s = st();
    if (configDoc) {
      const chave = s.config.ia.apiKey;
      Object.assign(s, configDoc);
      s.config.ia = { ...s.config.ia, apiKey: chave };
    }
    if (mesesDocs) s.lancamentos = Object.values(mesesDocs).flat();
    s.demo = false;
  }

  function comTempo(promessa, ms) {
    return Promise.race([promessa, new Promise((_, rej) => setTimeout(() => rej(new Error('tempo esgotado')), ms))]);
  }

  /* Carrega da nuvem. Se a nuvem estiver vazia, ela começa vazia (sem dados de exemplo). */
  async function iniciar() {
    if (!U.noClaude) return false;
    estado = 'conectando'; avisar();
    db = await window.claude.use('db');
    if (!db) { estado = 'offline'; avisar(); return false; }
    try {
      const [cfg, meses] = await comTempo(Promise.all([db.doc('casa/config').get(), db.collection('meses').get()]), 12000);
      const mesesDocs = {};
      meses.docs.forEach((d) => { mesesDocs[d.id] = (d.data() || {}).lancamentos || []; ultimo.meses[d.id] = JSON.stringify(mesesDocs[d.id]); });
      if (cfg.exists) {
        aplicarRemoto(cfg.data(), mesesDocs);
        ultimo.config = JSON.stringify(partes().config);
      } else {
        // primeira vez: começa do zero, mantendo categorias e ajustes padrão
        const s = st();
        s.lancamentos = Object.values(mesesDocs).flat();
        s.diario = []; s.acertos = []; s.demo = false;
        s.metas = [{ id: 'reserva', nome: 'Reserva de emergência', alvo: 0, guardado: 0, prazo: '', especial: true }];
      }
      estado = 'nuvem'; avisar();
      escutar();
      if (!cfg.exists) agendar();
      return true;
    } catch (e) {
      console.warn('nuvem indisponível', e);
      estado = 'offline'; avisar();
      return false;
    }
  }

  /* Mudanças feitas em outro aparelho (ou pela sua noiva) chegam aqui. */
  function escutar() {
    db.doc('casa/config').onSnapshot((snap) => {
      if (!snap.exists || snap.metadata.hasPendingWrites) return;
      const txt = JSON.stringify(snap.data());
      if (txt === ultimo.config) return;
      ultimo.config = txt;
      aplicarRemoto(snap.data(), null);
      FC.orquestrador.emitir('mudou');
    }, () => { estado = 'offline'; avisar(); });
    db.collection('meses').onSnapshot((snap) => {
      if (snap.metadata.hasPendingWrites) return;
      let mudou = false;
      snap.docChanges().forEach((ch) => {
        const id = ch.doc.id;
        const lista = ch.type === 'removed' ? [] : ((ch.doc.data() || {}).lancamentos || []);
        const txt = JSON.stringify(lista);
        if (ultimo.meses[id] === txt) return;
        ultimo.meses[id] = txt;
        st().lancamentos = st().lancamentos.filter((l) => (l.data || '').slice(0, 7) !== id).concat(lista);
        mudou = true;
      });
      if (mudou) FC.orquestrador.emitir('mudou');
    }, () => { estado = 'offline'; avisar(); });
  }

  /* Agrupa várias mudanças seguidas em uma gravação. */
  function agendar() {
    if (!db || estado !== 'nuvem') return;
    clearTimeout(timer);
    timer = setTimeout(gravar, 900);
  }

  function gravar() {
    fila = fila.then(async () => {
      const { config, meses } = partes();
      const cfgTxt = JSON.stringify(config);
      try {
        if (cfgTxt !== ultimo.config) { await db.doc('casa/config').set(config); ultimo.config = cfgTxt; }
        const ids = new Set([...Object.keys(meses), ...Object.keys(ultimo.meses)]);
        for (const id of ids) {
          const lista = meses[id] || [];
          const txt = JSON.stringify(lista);
          if (txt === ultimo.meses[id]) continue;
          if (lista.length) await db.doc(`meses/${id}`).set({ lancamentos: lista });
          else await db.doc(`meses/${id}`).delete();
          ultimo.meses[id] = txt;
        }
      } catch (e) {
        console.warn('falha ao gravar na nuvem', e);
        FC.orquestrador.log('arquivista', `Não consegui salvar na nuvem agora (${e.code || e.message}). Os dados continuam neste navegador; tento de novo na próxima mudança.`, 'aviso');
      }
    });
    return fila;
  }

  return {
    iniciar, agendar,
    get estado() { return estado; },
    aoMudar: (f) => ouvintes.push(f),
  };
})();
