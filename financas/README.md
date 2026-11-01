# Caderneta: finanças da casa

Controle financeiro pessoal e do casal, com uma equipe de agentes, cada um responsável por uma parte do trabalho.
Roda inteiro no navegador. Não precisa de servidor nem de instalação, e os dados ficam salvos só no aparelho (`localStorage`).

## Como abrir

- **Mais simples:** dê dois cliques em `index.html` (ou em `previa.html`, que é a mesma coisa num arquivo só).
- **Recomendado:** sirva a pasta localmente para o navegador tratar tudo como site:
  ```bash
  cd financas && python3 -m http.server 8000
  # abra http://localhost:8000
  ```

Na primeira vez ele já abre com **dados de exemplo** (12 meses de um casal) para você ver tudo funcionando.
Quando for usar de verdade, vá em **Ajustes → Começar do zero**. Categorias, orçamentos e ajustes continuam como estão.

## Abas

| Aba | Para que serve |
|---|---|
| Visão geral | Receitas, despesas, saldo e quanto falta pagar, mais os avisos, os gráficos e os próximos vencimentos |
| Lançamentos | Lista filtrável por conta, tipo, categoria, status e busca. Clique no status para marcar como pago, use a seleção em lote e exporte em CSV |
| Contas a pagar | Contas agrupadas em atrasadas, hoje, próximos 7 dias e resto do mês, com botão para gerar as contas recorrentes |
| Importar recibos | PDF, foto, boleto, extrato CSV/OFX ou texto colado (SMS do banco). Você revisa cada item antes de lançar |
| Orçamento e reservas | Divisão da renda em % (essenciais, pessoal, reserva, metas) e limite por categoria |
| Conta do casal | Divisão meio a meio, proporcional à renda ou personalizada, com cálculo de quem deve quanto e registro do acerto |
| Metas | Reserva de emergência (alvo = N meses de custo essencial) e metas com prazo e aporte mensal necessário |
| Relatórios | Evolução de 12 meses, observações automáticas, ranking de estabelecimentos, resumo em .txt e impressão em PDF |
| Categorias | Criar, editar, agrupar e definir orçamento. Mostra também as regras que o Classificador aprendeu |
| Agentes | O que cada agente faz e o diário de bordo com tudo que eles fizeram |
| Ajustes | Nomes do casal, chave do Claude, OCR local, backup e restauração |

## Os agentes

```
            arquivo ──► Leitor ──► Extrator ─────┐
                            └──► Analista IA ────┤──► Classificador ──► Sentinela ──► revisão ──► Tesoureiro
                                 (opcional)      │
                                                 └ (extrato CSV/OFX: várias linhas de uma vez)

 Tesoureiro ◄──► Planejador · Divisor · Sentinela · Analista · Arquivista
```

| Agente | Arquivo | Responsabilidade |
|---|---|---|
| Orquestrador | `js/core/agentes.js` | Registro dos agentes, barramento de eventos, diário de bordo e pipeline de importação |
| Leitor | `js/agents/leitor.js` | Abre PDF (pdf.js), imagem, CSV, OFX e texto. Faz OCR (Tesseract) se ativado |
| Extrator | `js/agents/extrator.js` | Acha valor total, datas, vencimento, CNPJ, estabelecimento e itens. Decodifica a **linha digitável do boleto** (valor e vencimento) e converte extratos em lançamentos |
| Classificador | `js/agents/classificador.js` | Escolhe a categoria por palavras-chave (quase 300 termos de lojas e serviços brasileiros) e **aprende com as suas correções** |
| Analista IA | `js/agents/ia.js` | Opcional. Manda o documento ao Claude e recebe os dados estruturados (JSON validado por esquema) |
| Tesoureiro | `js/agents/tesoureiro.js` | Cria e edita lançamentos, cuida do status, das parcelas e das contas recorrentes |
| Planejador | `js/agents/planejador.js` | Divisão da renda, orçamentos, reserva de emergência e metas |
| Divisor | `js/agents/divisor.js` | Conta conjunta: percentual de cada um, acerto e histórico |
| Sentinela | `js/agents/sentinela.js` | Avisa sobre contas atrasadas ou perto do vencimento, orçamento estourado, duplicidades e reserva baixa |
| Analista | `js/agents/analista.js` | Séries mensais, comparativos, projeção do mês e observações escritas |
| Arquivista | `js/agents/arquivista.js` | Exporta CSV (abre no Excel com acentos certos), faz backup JSON e restaura |

## Analista IA (Claude)

Sem chave, tudo funciona localmente: PDFs com texto, boletos e extratos são lidos pelo Extrator.
Para fotos de cupom, PDFs escaneados e layouts confusos, coloque sua chave da API da Anthropic em **Ajustes**.
Por padrão o modelo é o Claude Opus 5.5. O Sonnet 5.5 e o Haiku 5.5, mais baratos, também podem ser escolhidos.

- A chamada usa o SDK oficial (`@anthropic-ai/sdk`) direto do navegador, com saída estruturada por JSON Schema e esforço `low`.
- O *fallback* automático do servidor (`fallbacks: "default"`) está ligado: se o modelo recusar um documento, a API tenta outro modelo sozinha.
- A chave fica só no `localStorage` deste navegador e **nunca vai para o backup**. Use uma chave com limite de gastos.

## Dados, backup e privacidade

- Tudo fica no navegador onde você usa. Para passar para outro aparelho, use **Ajustes → Baixar backup** e depois **Restaurar backup** no outro.
- Limpar os dados do navegador apaga os lançamentos, então faça backup de vez em quando.
- Se esta pasta for publicada no GitHub Pages, a *página* fica pública, mas os *dados* não: cada pessoa que abrir vê só o que estiver no próprio navegador.

## Estrutura

```
financas/
├── index.html            # app (arquivos separados)
├── previa.html           # mesmo app num arquivo só (gerado)
├── css/app.css           # visual: verde musgo, marrom e bege
├── js/core/              # util, estado (store) e orquestrador
├── js/agents/            # um arquivo por agente
├── js/ui/                # gráficos SVG e telas
├── vendor/               # pdf.js (Apache 2.0) para ler PDFs offline
└── tools/montar-previa.js
```

Depois de mexer no código, rode `node tools/montar-previa.js` para atualizar o `previa.html`.
