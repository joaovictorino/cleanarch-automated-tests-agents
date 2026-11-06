# Spec 01 — Construir o chat

## Objetivo e limite desta etapa

Criar uma aplicação executável que a turma consiga explorar antes de escrever a suíte automatizada. Aplicar integralmente `SPEC_LABORATORIO_04_CHAT.md`. Nesta etapa, não instalar Jest, Supertest ou Promptfoo, não criar dataset executável de avaliação e não gerar resultados de qualidade.

## Arquivos a produzir na aplicação

| Caminho relativo a `laboratorio-04/` | Responsabilidade |
| --- | --- |
| `package.json`, `package-lock.json`, `tsconfig.json` | Runtime, dependências exatas, build e typecheck |
| `.env.example`, `.gitignore` | Configuração por ambiente e exclusões |
| `src/config.ts` | Leitura validada da configuração; sem exposição de chave |
| `src/modelo/ModelClient.ts` | Interface injetável do cliente de modelo |
| `src/modelo/AzureModelClient.ts` | Único ponto de chamada ao Azure |
| `src/modelo/FakeModelClient.ts` | Roteiros limitados para a exploração offline |
| `src/dominio/contratos.ts` | Tipos e schemas de argumentos/resposta |
| `src/dominio/ferramentas.ts` | Consulta e simulação sem mutação |
| `src/dominio/dispatcher.ts` | Registro da tentativa, validação e autorização |
| `src/assistente.ts` | `executarTurno` e loop de ferramentas |
| `src/sessoes.ts` | Estado e histórico isolados por sessão |
| `src/trace.ts` | Trace local e sanitização |
| `src/app.ts` | `createApp(deps)` exportada, sem chamar listen |
| `src/server.ts` | Inicialização e listen em localhost |
| `public/index.html`, `public/app.js`, `public/styles.css` | Chat no navegador |
| `prompts/base.txt`, `prompts/v1.txt`, `prompts/v2.txt` | Contrato fixo e instruções versionadas |
| `schemas/resposta.schema.json` | JSON Schema discriminado por ação |
| `scripts/smoke.ts` | Uma interação pelo mesmo núcleo usado no chat |
| `README.md` | Instalação, exploração e limites do modo fake |

Pode reorganizar detalhes internos para clareza, conservando os pontos públicos usados pelas próximas etapas: `executarTurno`, `ModelClient`, `createApp`, schemas, prompts e trace.

Usar TypeScript compilado para CommonJS em `dist/`, package `type: commonjs`, `target: ES2022`, `module: Node16`, `moduleResolution: Node16` e `esModuleInterop: true`. Essa escolha facilita providers `.cjs` e testes sem um segundo pipeline de TypeScript.

Dependências de runtime previstas: `express`, `openai`, `dotenv` e `ajv` para validar JSON Schema/argumentos. Ferramentas de desenvolvimento: TypeScript, `tsx`, tipos necessários. Escolher versões compatíveis e fixá-las, sem inventar números.

O `.gitignore` exclui `.env`, variações locais de ambiente, `node_modules/`, `dist/`, evidências geradas e dados locais do Promptfoo; preserva `.env.example`, datasets e templates. Não versionar traces automaticamente.

## Interface do modelo

`ModelClient` recebe mensagens e definições de ferramentas e devolve a mensagem do assistente, incluindo possíveis `tool_calls`, e uso de tokens quando disponível. Não conhece Express, caso de teste, oráculo ou Promptfoo.

`AzureModelClient` instancia o cliente oficial com a base v1, chave, timeout e retries desabilitados; chama `chat.completions.create` com o deployment e o conjunto de mensagens/ferramentas definido no contrato comum. Toda diferença futura de provedor fica nessa camada.

`FakeModelClient` implementa o mesmo protocolo de mensagens e chamadas. Oferecer três exemplos exatos na UI:

1. `Qual é o saldo da conta 1001?` → `consultarSaldo` e resposta `informar_saldo`.
2. `Simule R$ 30,00 da conta 1001 para a conta 2002.` → `simularTransferencia` e resposta `simular`.
3. `Simule R$ 30,00 da conta 1001.` → `pedir_dados` com `destinoId`, sem chamada.

Nesses exemplos, construir a resposta final com os resultados de ferramenta efetivamente recebidos. O fake não lê o oráculo nem burla o loop. Entradas diferentes retornam uma recusa identificada de modo roteirizado, código `DADOS_INVALIDOS`, explicando quais exemplos estão disponíveis. Não implementar um classificador de linguagem natural para esse dublê.

O chat real deve suportar continuação de conversa, por exemplo o usuário informar o destino em um segundo turno. Essa capacidade decorre do histórico e será exercitada com cliente injetado na Spec 02 e manualmente no Azure.

## Prompt e resposta

Criar `base.txt` com o escopo de consulta/simulação e o contrato JSON completo. Copiar `v1.txt` e `v2.txt` deste pacote, sem incluir IDs de casos ou respostas do dataset. Compor a base fixa e o prompt selecionado de modo idêntico em chat, smoke e avaliação.

Não forçar uma resposta JSON fabricada no backend. Em saída inválida, mostrar aviso e resposta bruta em área de texto segura. Registrar o erro sem apagar a conversa anterior.

## Sessões e tela

Criar uma sessão ao abrir a página. Persistir `sessionId` somente em memória da página. Nova conversa exclui a sessão atual e cria outra; recarregar a página cria uma nova sessão.

O seletor V1/V2 é uma opção didática. Na avaliação formal, o provider sempre usa sessão/histórico novos. Na exploração manual, a versão pode mudar entre turnos, e o trace registra essa escolha; não confundir essa exploração com a comparação controlada.

A tela identifica o modo antes do primeiro envio. Exibir mensagem, ação e dados monetários formatados; oferecer detalhes JSON e resumo de tentativas. Não mostrar valores de variáveis de ambiente ou erros brutos do SDK. Toda saída do modelo é texto, nunca HTML executável.

## Scripts obrigatórios após esta etapa

| Comando | Comportamento |
| --- | --- |
| `npm run dev` | Inicia servidor com recarga e configuração local |
| `npm run build` | Compila TypeScript para `dist/` |
| `npm start` | Inicia o servidor compilado |
| `npm run typecheck` | Verifica tipos sem emitir arquivos |
| `npm run smoke` | Usa o modo selecionado no `.env` para uma consulta à conta 1001 |
| `npm run smoke -- offline` | Força fake de modo explícito, independentemente do `.env` |

O smoke confere contrato final, tentativa/resultado de consulta, saldo consistente com a ferramenta e ausência de mutação. Imprimir somente modo, status, `traceId` e caminho do trace. Se um modelo real não cumprir o contrato ou não usar a ferramenta esperada, o smoke falha; não mascarar como sucesso de conectividade.

Não criar script `test` que retorna sucesso vazio. A etapa 02 criará esse comando.

## Verificação manual de aceite

- `typecheck` e build concluem; servidor inicia em `http://localhost:3004`.
- Os três exemplos fake passam pelo núcleo e exibem o modo roteirizado.
- Simular R$ 30,00 projeta 7000/5000; consultar novamente preserva 10000/2000.
- Uma sessão nova não compartilha histórico com a anterior.
- Resposta malformada é exibida como inválida quando um dublê de desenvolvimento a produzir.
- Configuração Azure incompleta falha com nomes dos campos ausentes, sem revelar seus valores.
- Com os três dados de um deployment compatível, o smoke real usa o cliente Azure; erro de acesso não muda para fake.

Ao apresentar à turma, mostrar o caminho navegador → rota → núcleo → modelo → dispatcher → ferramenta → resposta. O objetivo é reconhecer esse fluxo antes da automação.
