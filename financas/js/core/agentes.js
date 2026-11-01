/*
 * Orquestrador: registro de agentes + barramento de eventos.
 * Cada agente tem um papel único, registra o que fez no diário e
 * conversa com os outros apenas por eventos ou pelo orquestrador.
 */
FC.orquestrador = (() => {
  const agentes = {};
  const ouvintes = {};

  function registrar(def) {
    agentes[def.id] = Object.assign({ status: 'ocioso', ultimaAcao: null, execucoes: 0 }, def);
    return agentes[def.id];
  }

  function log(agenteId, mensagem, nivel = 'info') {
    const a = agentes[agenteId];
    if (a) { a.ultimaAcao = mensagem; a.execucoes++; }
    const entrada = { em: new Date().toISOString(), agente: agenteId, mensagem, nivel };
    const st = FC.store.estado;
    st.diario.unshift(entrada);
    if (st.diario.length > 300) st.diario.length = 300;
    FC.store.salvar(false);
    emitir('diario', entrada);
  }

  function status(agenteId, s) {
    if (agentes[agenteId]) agentes[agenteId].status = s;
    emitir('agente-status', { agenteId, status: s });
  }

  function on(evento, fn) { (ouvintes[evento] = ouvintes[evento] || []).push(fn); }
  function emitir(evento, dados) { (ouvintes[evento] || []).forEach((fn) => { try { fn(dados); } catch (e) { console.error(e); } }); }

  /*
   * Pipeline de importação: Leitor → (Analista IA | Extrator) → Classificador → Sentinela
   * Retorna uma lista de "rascunhos" para o usuário revisar antes de virar lançamento.
   */
  async function processarArquivo(file, opcoes) {
    const etapas = (e) => emitir('pipeline', { arquivo: file.name, etapa: e });
    try {
      etapas('leitor');
      const lido = await FC.agentes.leitor.ler(file);

      let rascunhos;
      if (lido.tipo === 'csv' || lido.tipo === 'ofx') {
        etapas('extrator');
        rascunhos = FC.agentes.extrator.extrairExtrato(lido);
      } else if (lido.tipo === 'pdf' && FC.agentes.extrator.pareceExtrato(lido.texto || '')) {
        // extrato bancário em PDF: uma linha por movimentação, lido localmente
        etapas('extrator');
        rascunhos = FC.agentes.extrator.extrairExtratoPDF(lido.texto, file.name);
      } else {
        const iaPronta = FC.agentes.ia.disponivel();
        const precisaIA = !lido.texto || lido.texto.trim().length < 25;
        if (iaPronta && (opcoes.usarIA || precisaIA)) {
          etapas('ia');
          try {
            rascunhos = [await FC.agentes.ia.analisar(lido)];
          } catch (e) {
            log('ia', `Não consegui analisar "${file.name}": ${e.message}. Caindo para o Extrator local.`, 'aviso');
          }
        }
        if (!rascunhos) {
          if (precisaIA && lido.tipo === 'imagem' && FC.store.estado.config.ocr) {
            etapas('leitor');
            lido.texto = await FC.agentes.leitor.ocr(file);
          }
          etapas('extrator');
          rascunhos = [FC.agentes.extrator.extrair(lido.texto || '', file.name)];
        }
      }

      etapas('classificador');
      rascunhos = rascunhos.map((r) => {
        const c = r.interno
          ? { categoriaId: r.tipo === 'despesa' ? 'investimentos' : 'extra', confianca: 0.9, motivo: 'entre suas contas — fica de fora' }
          : r.categoriaId ? { categoriaId: r.categoriaId, confianca: r.confianca ?? 0.8, motivo: 'sugerido pela IA' }
            : FC.agentes.classificador.classificar(r);
        return Object.assign({
          id: FC.util.uid(),
          tipo: 'despesa',
          conta: opcoes.conta,
          pagoPor: opcoes.conta === 'casal' ? 'a' : opcoes.conta,
          status: 'pendente',
          arquivo: file.name,
        }, r, c);
      });

      etapas('sentinela');
      rascunhos.forEach((r) => { r.duplicado = FC.agentes.sentinela.pareceDuplicado(r); });
      etapas('pronto');
      return rascunhos;
    } catch (e) {
      log('leitor', `Erro ao processar "${file.name}": ${e.message}`, 'erro');
      etapas('erro');
      return [];
    }
  }

  return { registrar, agentes, log, status, on, emitir, processarArquivo };
})();

FC.agentes = {};
