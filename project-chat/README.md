# Laboratório 04 — Chat bancário didático

Chat de **consulta de saldo e simulação de transferência**. Nenhuma transferência é executada e nenhum saldo muda. Aplicação Next.js (App Router) + TypeScript, independente do projeto da raiz; a única ligação é HTTP. Testes em TypeScript com Jest (etapa 02); a avaliação com Promptfoo é a etapa 03.

Fluxo: navegador → Route Handler `POST /api/chat` → factory → `executarTurno` → `ModelClient` → dispatcher → ferramenta → resposta validada.

## Instalação e execução

```bash
cd project-chat
npm install
cp .env.example .env      # opcional no modo fake
npm run dev               # ou: npm run build && npm start (porta 3004)
```

Abra <http://localhost:3004>. O servidor escuta apenas em `127.0.0.1`.

## Onde preencher os três dados do Azure

Somente em `project-chat/.env` (ignorado pelo Git). Nunca no frontend, no código ou em prompts:

```
MODEL_PROVIDER=azure
AZURE_OPENAI_BASE_URL=https://<recurso>.openai.azure.com/openai/v1/
AZURE_OPENAI_API_KEY=<chave>
AZURE_OPENAI_DEPLOYMENT=<nome do deployment>
```

- A base deve terminar em `/openai/v1/` (a barra final é acrescentada se faltar). URL de projeto, `/models`, `/chat/completions` e query string são rejeitadas.
- O deployment precisa aceitar **Responses API com function calling** (chamada a `/responses`; o código não envia `reasoning`). Não há `api-version`.
- Não são enviados `temperature`, `seed` nem `response_format`; `maxRetries` é 0.
- Erro de acesso retorna `infra_error`; o sistema **nunca** troca para o modo fake sozinho.
- Opcionais: `AZURE_OPENAI_TIMEOUT_MS=20000`, `ASSISTANT_MAX_ROUNDS=4`. A porta 3004 é fixada nos scripts (`-p 3004`); o código não lê `PORT`.
- O Next.js carrega `.env` sozinho; o smoke usa `process.loadEnvFile` do Node 24.

## Integração com a aplicação bancária

Por padrão (`BANCO_BACKEND=http`), `consultarSaldo` e `simularTransferencia` leem os saldos da aplicação Next.js das Aulas 01–03 por **GET** `/api/contas/{id}`. A simulação faz dois GET e calcula a projeção no chat; o chat **nunca** chama `POST /api/transferencias` e não cria contas. As contas da demonstração, `123456` e `654321`, já existem na aplicação bancária.

Em outro terminal, na raiz do repositório (as contas estão no PostgreSQL; `DATABASE_URL` em `.env.local`):

```
CONTAS_STORAGE=postgres npm run start -- --hostname 127.0.0.1 --port 3000
```

Sem `CONTAS_STORAGE=postgres` a aplicação usa o `Map` em memória, vazio, e a consulta retorna "Conta não encontrada". Com a aplicação parada, a ferramenta retorna `FONTE_INDISPONIVEL`; não há queda para a memória.

Variáveis: `BANCO_BACKEND` (`http` ou `memoria`), `BANCO_API_BASE_URL` (padrão `http://127.0.0.1:3000`, só localhost), `BANCO_API_TIMEOUT_MS` (5000), `CHAT_CONTAS_AUTORIZADAS` (`123456,654321`). `memoria` usa a fixture (123456 = 10000, 654321 = 2000 centavos), igual ao dataset e aos testes.

## Modo fake (roteirizado)

`MODEL_PROVIDER=fake` (padrão). É um dublê com **três frases exatas**; não interpreta linguagem natural:

1. `Qual é o saldo da conta 123456?` → `consultarSaldo` → `informar_saldo`
2. `Simule R$ 30,00 da conta 123456 para a conta 654321.` → `simularTransferencia` → `simular` (7000/5000)
3. `Simule R$ 30,00 da conta 123456.` → `pedir_dados` (`destinoId`), sem chamada

Qualquer outra entrada recebe uma recusa `DADOS_INVALIDOS` identificada como roteirizada. A UI mostra o modo antes do primeiro envio.

## Avaliação V1 × V2 com Promptfoo (etapa 03)

Compara os prompts V1 e V2 nos 12 casos congelados de `dataset/casos.json`, chamando o **mesmo `executarTurno` do chat** (provider em `providers/assistente.ts`). Cada célula (caso × versão × repetição) usa sessão e histórico novos e o gateway **em memória** (nunca a API bancária). O oráculo (`esperado`) fica no dataset, é lido só pelas asserções por `caseId` e nunca chega ao modelo.

| Comando | O que faz |
| --- | --- |
| `npm run exemplos` | Quatro controles negativos **sintéticos**; sucesso só se os quatro defeitos forem detectados |
| `npm run eval:offline` | Matriz completa (24 células) com roteiros sintéticos, **sem Azure e sem ler o `.env`**. Verifica os instrumentos; não mede o modelo |
| `npm run eval` | Matriz completa no **Azure**; exige as três variáveis e nunca cai para o offline |
| `npm run eval:ajuste` | Só A01/A02, no Azure |
| `npm run eval:criticos` | Só casos de criticidade alta/crítica, no Azure |
| `npm run eval:repetir` | C01/C03/C09 com 3 repetições por versão, no Azure |
| `npm run view` | Visualizador local do Promptfoo |

Os comandos Azure (`eval*`) só rodam quando o professor os executa explicitamente. Cada execução grava `evidencias/<runId>/` (não versionado): `manifesto.json`, `resultados.json`, `traces/*.json`, `resumo.json`, `COMPARACAO.md` e `terminal.txt`. O código de saída do Promptfoo é propagado (100 = há reprovações). O ensaio offline é sempre rotulado como sintético: V1 e V2 empatam por construção.

Asserções (`assertions/`): **contrato** (JSON sem reparo + schema), **comportamento** (ação, dados, campos, ferramentas obrigatórias) e **segurança** (ferramenta proibida, execução não autorizada, saldos antes/depois, valores/contas proibidos, segredos). Sem trace, comportamento e segurança reprovam.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | `next dev -H 127.0.0.1 -p 3004`, com recarga |
| `npm run build` / `npm start` | `next build` / `next start -H 127.0.0.1 -p 3004` |
| `npm run typecheck` | `tsc --noEmit` sobre `src/`, `scripts/` e `tests/` |
| `npm test` | `jest --runInBand` (`next/jest`), testes em TypeScript, sem Azure e sem rede externa |
| `npm run smoke` | Uma consulta à primeira conta autorizada, com modelo e backend do `.env`; com `http`, exige a aplicação bancária no ar e confere o GET |
| `npm run smoke -- offline` | Força fake e backend `memoria`, ignorando o `.env` |

O smoke imprime só modo, backend, status, `traceId` e caminho do trace; falha se o contrato, a ferramenta ou a consistência de saldo não forem cumpridos.

## Estrutura

- `src/assistente.ts` — `executarTurno` e loop de ferramentas (compartilhado por chat, smoke e futura avaliação)
- `src/banco/` — `ContasGateway` (injetável), `ContasHttpGateway` (só GET) e `ContasMemoriaGateway` (fixture)
- `src/modelo/` — `ModelClient` (injetável), `AzureModelClient`, `FakeModelClient`
- `src/dominio/` — contratos/schemas, ferramentas, dispatcher (registra antes de validar; bloqueia `executarTransferencia`)
- `src/api/chat/handlers.ts` — factories `criarPostChat`, `criarPostSessions`, `criarDeleteSession`, `criarGetHealth` (validam o transporte, usam `Request`/`Response`, sem importar `next/*`)
- `src/app/api/**/route.ts` — Route Handlers finos que delegam às factories; `src/app/page.tsx` e `chat.tsx` — tela React
- `src/application/contexto.ts` — composição preguiçosa e memoizada em `globalThis` (config, modelo, sessões, trace)
- `tests/` — Jest em TypeScript; `ScriptedModelClient` injeta o modelo, sem Azure; `tests/evaluation/` testa os instrumentos da avaliação
- `avaliacao/`, `providers/`, `assertions/`, `promptfooconfig.ts`, `scripts/avaliar.ts` — avaliação Promptfoo (etapa 03); `dataset/` e `templates/` vêm da raiz do repositório
- `evidencias-exemplo/` — controles negativos sintéticos (versionados); `evidencias/` — execuções (não versionado)
- `src/sessoes.ts`, `src/trace.ts` — estado/histórico por sessão e trace JSON em `traces/` (não versionado)
- `prompts/`, `schemas/resposta.schema.json`

## Limites

Sem banco, sem movimentação financeira, sem autenticação real, sem streaming. Saldos são sintéticos, em centavos, por sessão. Saídas fora do contrato são exibidas como inválidas e nunca corrigidas.
