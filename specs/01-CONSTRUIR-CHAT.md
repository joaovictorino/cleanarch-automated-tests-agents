# Spec 01 — Construir o chat

## Objetivo e limite desta etapa

Criar uma aplicação executável que a turma consiga explorar antes de escrever a suíte automatizada. Aplicar integralmente `SPEC_LABORATORIO_04_CHAT.md`.

O projeto é **novo**: criar `laboratorio-04/` do zero, como aplicação Next.js independente com `package.json` e `node_modules` próprios. Se a pasta já existir, não sobrescrever nem apagar nada: descrever o que há e parar. Não importar nem copiar código do projeto da raiz; a única ligação é HTTP (seção "Integração com a aplicação bancária"). Nesta etapa, não instalar Jest ou Promptfoo, não criar dataset executável de avaliação e não gerar resultados de qualidade.

## Arquivos a produzir na aplicação

| Caminho relativo a `laboratorio-04/` | Responsabilidade |
| --- | --- |
| `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts` | Next.js + TypeScript strict, dependências exatas, build e typecheck |
| `.env.example`, `.gitignore` | Configuração por ambiente (modelo e banco) e exclusões. O `.env.example` lista **somente os nomes** das variáveis, sem valores, chaves ou tokens; não copiar o `.env.example` da raiz |
| `src/config.ts` | Leitura validada da configuração; sem exposição de chave |
| `src/modelo/ModelClient.ts` | Interface injetável do cliente de modelo |
| `src/modelo/AzureModelClient.ts` | Único ponto de chamada ao Azure |
| `src/modelo/FakeModelClient.ts` | Roteiros limitados para a exploração offline |
| `src/dominio/contratos.ts` | Tipos e schemas de argumentos/resposta |
| `src/dominio/ferramentas.ts` | Consulta e simulação sem mutação, via `ContasGateway` |
| `src/banco/ContasGateway.ts` | Interface injetável de leitura de contas |
| `src/banco/ContasHttpGateway.ts` | Integração real: `GET` na aplicação bancária (Aulas 01–03) |
| `src/banco/ContasMemoriaGateway.ts` | Fixture em memória, usada por testes, avaliação e `smoke -- offline` |
| `src/dominio/dispatcher.ts` | Registro da tentativa, validação e autorização |
| `src/assistente.ts` | `executarTurno` e loop de ferramentas |
| `src/sessoes.ts` | Estado e histórico isolados por sessão |
| `src/trace.ts` | Trace local e sanitização |
| `src/api/chat/handlers.ts` | Factories `criarPostChat`, `criarPostSessions`, `criarDeleteSession` e `criarGetHealth(deps)`: validação de transporte e tradução para HTTP, sem importar `next/*` |
| `src/application/contexto.ts` | Composição preguiçosa e memoizada em `globalThis`: config, `ModelClient`, `ContasGateway` por turno, `SessionStore`, trace |
| `src/app/api/health/route.ts`, `src/app/api/sessions/route.ts`, `src/app/api/sessions/[id]/route.ts`, `src/app/api/chat/route.ts` | Route Handlers finos que delegam às factories |
| `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/chat.tsx`, `src/app/globals.css` | Página mínima e componente cliente do chat em React |
| `prompts/base.txt`, `prompts/v1.txt`, `prompts/v2.txt` | Contrato fixo e instruções versionadas |
| `schemas/resposta.schema.json` | JSON Schema discriminado por ação |
| `scripts/smoke.ts` | Uma interação pelo mesmo núcleo usado no chat |
| `README.md` | Instalação, exploração e limites do modo fake |

Pode reorganizar detalhes internos para clareza, conservando os pontos públicos usados pelas próximas etapas: `executarTurno`, `ModelClient`, `ContasGateway`, as factories de `src/api/chat/handlers.ts`, schemas, prompts e trace.

Usar Next.js com App Router e TypeScript `strict`, no padrão de `tsconfig` do Next (`moduleResolution: bundler`), sem `type: module` no `package.json`. Todo o código, incluindo `scripts/*.ts`, é TypeScript; scripts rodam com `tsx`. Não há `dist/` nem build manual para testes: o Jest (`next/jest`) e o `tsx` executam TypeScript direto. `npm run build` é o `next build`.

Dependências de runtime previstas: `next`, `react`, `react-dom`, `openai` e `ajv` para validar JSON Schema/argumentos. Ferramentas de desenvolvimento: TypeScript, `tsx` e os tipos necessários (`@types/node`, `@types/react`, `@types/react-dom`). Sem Express, sem `dotenv`, sem Tailwind e sem biblioteca de componentes. Escolher versões compatíveis e fixá-las, sem inventar números.

O `.gitignore` exclui `.env`, variações locais de ambiente, `node_modules/`, `.next/`, evidências geradas e dados locais do Promptfoo; preserva `.env.example`, datasets e templates. Não versionar traces automaticamente.

## Interface do modelo

`ModelClient` recebe mensagens e definições de ferramentas e devolve a mensagem do assistente, incluindo possíveis `tool_calls`, e uso de tokens quando disponível. Não conhece Next.js, React, `Request`/`Response`, caso de teste, oráculo ou Promptfoo.

`AzureModelClient` instancia o cliente oficial com a base v1, chave, timeout e retries desabilitados; chama `responses.create` (Responses API) com o deployment e o conjunto de mensagens/ferramentas definido no contrato comum, convertendo-o para itens da Responses API (`function_call`, `function_call_output`) apenas nessa camada; envia `store: false` e não envia `reasoning`. Toda diferença futura de provedor fica nessa camada.

`FakeModelClient` implementa o mesmo protocolo de mensagens e chamadas. Oferecer três exemplos exatos na UI:

1. `Qual é o saldo da conta 123456?` → `consultarSaldo` e resposta `informar_saldo`.
2. `Simule R$ 30,00 da conta 123456 para a conta 654321.` → `simularTransferencia` e resposta `simular`.
3. `Simule R$ 30,00 da conta 123456.` → `pedir_dados` com `destinoId`, sem chamada.

Nesses exemplos, construir a resposta final com os resultados de ferramenta efetivamente recebidos. O fake não lê o oráculo nem burla o loop. Entradas diferentes retornam uma recusa identificada de modo roteirizado, código `DADOS_INVALIDOS`, explicando quais exemplos estão disponíveis. Não implementar um classificador de linguagem natural para esse dublê.

O chat real deve suportar continuação de conversa, por exemplo o usuário informar o destino em um segundo turno. Essa capacidade decorre do histórico e será exercitada com cliente injetado na Spec 02 e manualmente no Azure.

## Integração com a aplicação bancária

O chat deixa de ser um ilhéu: em uso normal, as duas ferramentas leem a aplicação Next.js construída nas Aulas 01–03 (domínio `Conta`/`NumeroConta`/`TransferenciaValor`, handlers `src/api/**`, rotas `src/app/api/**`). O chat é **cliente HTTP** dessa aplicação. Não importar `src/domain` nem `src/api` da raiz, não acessar PostgreSQL e não duplicar regras bancárias; a aplicação bancária continua sendo a fonte de verdade de saldo e de formato de conta.

### Gateway injetável

`ferramentas.ts` depende da interface `ContasGateway` (`obterConta(numero) → {numero, saldoCentavos}`), sem conhecer `fetch`. Duas implementações:

| Implementação | Quando | Observação |
| --- | --- | --- |
| `ContasHttpGateway` | `BANCO_BACKEND=http` (padrão do chat e do smoke com `.env`) | Só método `GET`. Base `BANCO_API_BASE_URL` (padrão `http://127.0.0.1:3000`), timeout `BANCO_API_TIMEOUT_MS` (padrão 5000), sem retry. Aceitar apenas `http`/`https` para `localhost` ou `127.0.0.1`. |
| `ContasMemoriaGateway` | `BANCO_BACKEND=memoria`, testes (Spec 02), avaliação (Spec 03) e `npm run smoke -- offline` | Usa `EstadoSessao.saldosCentavos` e as falhas injetadas (`null`, `TIMEOUT`). Permanece o único caminho determinístico para o dataset. |

A tela e o trace identificam o backend (`http` ou `memoria`) antes do primeiro envio, do mesmo modo que identificam o modo fake. Não trocar de `http` para `memoria` em silêncio quando a aplicação bancária estiver fora do ar: o resultado é `FONTE_INDISPONIVEL`.

### Mapeamento das ferramentas

| Ferramenta | Chamada real | Regra |
| --- | --- | --- |
| `consultarSaldo` | `GET /api/contas/{id}` → `200 {numero, saldo}` | A autorização da sessão é checada **antes** da chamada; conta não autorizada nunca gera requisição. `saldo` chega em reais e é convertido para centavos inteiros **somente** na borda do gateway; o restante do chat continua em centavos. |
| `simularTransferencia` | Dois `GET /api/contas/{id}` (origem e destino) | A projeção `origem − valor` / `destino + valor` é calculada no chat. **Proibido** chamar `POST /api/transferencias`: ele executa a transferência e altera saldos. Sem endpoint de simulação e sem novas rotas na aplicação bancária. |

Tradução de respostas da aplicação bancária (nunca por substring de mensagem; usar `status` e o campo `erro`):

| Resposta | Resultado da ferramenta |
| --- | --- |
| `400 CONTA_INVALIDA` | `DADOS_INVALIDOS` (o formato é decidido pelo domínio bancário; o chat não replica regex de número) |
| `404 CONTA_NAO_ENCONTRADA` (conta autorizada) | `DADOS_INVALIDOS`, mensagem sem detalhes internos |
| Timeout do gateway | `TIMEOUT` |
| Rede recusada, `5xx`, corpo fora do contrato | `FONTE_INDISPONIVEL` |

Mensagens da aplicação bancária, stack traces e URLs nunca vão para o modelo, para a tela ou para o trace. O trace registra método, caminho, status e duração de cada chamada, sem corpo.

### Contas da demonstração

A aplicação bancária exige número de **seis dígitos**. As contas da demonstração **já existem** nela: `123456` e `654321`. O chat não cria contas e não tem script de seed; não escrever na aplicação bancária. No backend `http`, as contas autorizadas da sessão são `123456` e `654321`, configuráveis por `CHAT_CONTAS_AUTORIZADAS`. Os saldos reais não são fixados pela spec: lê-se da API e nenhum teste ou verificação supõe valores específicos nesse backend. Se uma das contas não existir na instância em execução, a ferramenta retorna `DADOS_INVALIDOS` (`404 CONTA_NAO_ENCONTRADA`) e o professor deve conferir a aplicação bancária (`GET /api/contas`); ela pode estar em memória e ter sido reiniciada.

No backend `memoria`, a fixture usa os **mesmos** identificadores, `123456` (saldo 10000) e `654321` (saldo 2000), os mesmos do dataset da Spec 03 e dos testes da Spec 02. Assim, o fake, os testes, a avaliação e o chat real falam das mesmas contas; só a origem do saldo muda. Nenhuma dependência nova: `fetch` e `AbortSignal.timeout` do Node 24 bastam para o gateway, e os testes usam `node:http`.

Os três exemplos do fake usam as contas do backend ativo (`123456`/`654321` no `http`); a UI mostra o texto exato correspondente.

## Prompt e resposta

Criar `base.txt` com o escopo de consulta/simulação e o contrato JSON completo. Copiar `prompts/v1.txt` e `prompts/v2.txt`, que já estão na raiz do repositório, para `laboratorio-04/prompts/`, sem incluir IDs de casos ou respostas do dataset. Não copiar `dataset/` nem `templates/` nesta etapa. Compor a base fixa e o prompt selecionado de modo idêntico em chat, smoke e avaliação.

Não forçar uma resposta JSON fabricada no backend. Em saída inválida, mostrar aviso e resposta bruta em área de texto segura. Registrar o erro sem apagar a conversa anterior.

## Sessões e tela

Criar uma sessão ao abrir a página. Persistir `sessionId` somente em memória da página. Nova conversa exclui a sessão atual e cria outra; recarregar a página cria uma nova sessão.

O seletor V1/V2 é uma opção didática. Na avaliação formal, o provider sempre usa sessão/histórico novos. Na exploração manual, a versão pode mudar entre turnos, e o trace registra essa escolha; não confundir essa exploração com a comparação controlada.

A tela identifica o modo antes do primeiro envio. Exibir mensagem, ação e dados monetários formatados; oferecer detalhes JSON e resumo de tentativas. Não mostrar valores de variáveis de ambiente ou erros brutos do SDK. Toda saída do modelo é texto, nunca HTML executável.

## Scripts obrigatórios após esta etapa

| Comando | Comportamento |
| --- | --- |
| `npm run dev` | `next dev -H 127.0.0.1 -p 3004`, com recarga e configuração local |
| `npm run build` | `next build` |
| `npm start` | `next start -H 127.0.0.1 -p 3004` |
| `npm run typecheck` | `tsc --noEmit` sobre `src/`, `scripts/` e, depois da etapa 02, `tests/` |
| `npm run smoke` | Usa modelo e backend do `.env` para uma consulta à primeira conta autorizada; com `http`, exige a aplicação bancária no ar e confere que o saldo veio de `GET /api/contas/{id}` |
| `npm run smoke -- offline` | Força fake e backend `memoria`, independentemente do `.env` |

O smoke confere contrato final, tentativa/resultado de consulta, saldo consistente com a ferramenta e ausência de mutação. Imprimir somente modo, backend, status, `traceId` e caminho do trace. Se um modelo real não cumprir o contrato ou não usar a ferramenta esperada, o smoke falha; não mascarar como sucesso de conectividade.

Não criar script `test` que retorna sucesso vazio. A etapa 02 criará esse comando.

## Verificação manual de aceite

- `typecheck` e `npm run build` concluem; `npm run dev` inicia em `http://localhost:3004`.
- Smoke de composição das rotas (uma factory não prova a rota): com o servidor no ar, `curl -X POST localhost:3004/api/sessions` retorna `{sessionId}` e `curl localhost:3004/api/health` retorna o modo e o backend.
- Os três exemplos fake passam pelo núcleo e exibem o modo roteirizado.
- Simular R$ 30,00 projeta 7000/5000; consultar novamente preserva 10000/2000.
- Backend `http`, com `npm run dev` da raiz (porta 3000): consultar `123456` retorna o mesmo saldo (em centavos) que `GET /api/contas/123456` na aplicação bancária.
- Backend `http`: simular R$ 30,00 de `123456` para `654321` devolve `saldo previsto = saldo atual ∓ 3000` (conforme os saldos lidos) e não altera saldos; `GET /api/contas` antes e depois é idêntico, e nenhuma chamada `POST /api/transferencias` aparece no trace.
- Backend `http` com a aplicação bancária parada: a ferramenta retorna `FONTE_INDISPONIVEL`; não há queda silenciosa para `memoria`.
- Conta fora de `CHAT_CONTAS_AUTORIZADAS`: `NAO_AUTORIZADO` sem nenhuma requisição à aplicação bancária.
- Uma sessão nova não compartilha histórico com a anterior.
- Resposta malformada é exibida como inválida quando um dublê de desenvolvimento a produzir.
- Configuração Azure incompleta falha com nomes dos campos ausentes, sem revelar seus valores.
- Com os três dados de um deployment compatível, o smoke real usa o cliente Azure; erro de acesso não muda para fake.

Ao apresentar à turma, mostrar o caminho navegador → Route Handler → factory → núcleo → modelo → dispatcher → ferramenta → gateway → API bancária (Next.js) → domínio `Conta` → resposta. O objetivo é reconhecer esse fluxo antes da automação.
