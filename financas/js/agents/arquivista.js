/* Agente Arquivista — exporta planilhas, faz backup e restaura seus dados. */
FC.agentes.arquivista = (() => {
  const O = FC.orquestrador;
  const U = FC.util;
  const st = () => FC.store.estado;
  O.registrar({
    id: 'arquivista', nome: 'Arquivista', sigla: 'AR',
    papel: 'Exporta CSV (abre no Excel/Sheets), faz backup completo em JSON e restaura quando precisar.',
  });

  const baixar = (nome, conteudo, tipo) => U.baixar(nome, conteudo, tipo)
    .then(() => true)
    .catch((e) => { O.log('arquivista', `Download de "${nome}" não concluído (${e.code || e.message}).`, 'aviso'); return false; });

  const celula = (v) => {
    const s = String(v ?? '');
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  function exportarCSV(lista, nome) {
    const p = st().config.pessoas;
    const cab = ['Data', 'Vencimento', 'Tipo', 'Descrição', 'Categoria', 'Grupo', 'Conta', 'Pago por', 'Valor', 'Status', 'Pago em', 'Forma', 'Recorrente', 'Parcela', 'Origem', 'Notas'];
    const linhas = lista.map((l) => [
      U.dataBR(l.data), U.dataBR(l.vencimento), l.tipo, l.descricao, FC.store.categoria(l.categoriaId).nome,
      FC.store.categoria(l.categoriaId).grupo, FC.store.nomeConta(l.conta), l.pagoPor === 'a' ? p.a : p.b,
      l.valor.toFixed(2).replace('.', ','), FC.agentes.tesoureiro.situacao(l), U.dataBR(l.pagoEm), l.forma,
      l.recorrente ? 'sim' : 'não', l.parcela ? `${l.parcela.n}/${l.parcela.total}` : '', l.origem, l.notas,
    ].map(celula).join(';'));
    // BOM para o Excel reconhecer acentos
    baixar(nome, '﻿' + [cab.join(';'), ...linhas].join('\r\n'), 'text/csv;charset=utf-8');
    O.log('arquivista', `Exportei ${lista.length} lançamento(s) em "${nome}".`);
  }

  function backup() {
    const nome = `backup-financas-${U.hoje()}.json`;
    const copia = JSON.parse(JSON.stringify(st()));
    copia.config.ia.apiKey = ''; // nunca exporta a chave
    baixar(nome, JSON.stringify(copia, null, 2), 'application/json');
    O.log('arquivista', `Backup completo salvo em "${nome}" (${st().lancamentos.length} lançamentos).`);
  }

  async function restaurar(file) {
    const dados = JSON.parse(await file.text());
    if (!dados || !Array.isArray(dados.lancamentos) || !Array.isArray(dados.categorias)) throw new Error('arquivo não parece um backup deste app');
    const chave = st().config.ia.apiKey;
    FC.store.substituir(dados);
    st().config.ia.apiKey = chave;
    FC.store.salvar();
    O.log('arquivista', `Backup "${file.name}" restaurado (${dados.lancamentos.length} lançamentos).`);
  }

  function modeloCSV() {
    baixar('modelo-importacao.csv', '﻿Data;Descrição;Valor\r\n05/11/2026;Salário;8200,00\r\n07/11/2026;Carrefour;-412,35\r\n10/11/2026;Aluguel;-2650,00\r\n', 'text/csv;charset=utf-8');
  }

  return { exportarCSV, backup, restaurar, modeloCSV, baixar };
})();
