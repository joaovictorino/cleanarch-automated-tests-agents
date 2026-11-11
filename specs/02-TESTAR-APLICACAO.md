# Spec 02 — Acrescentar testes da aplicação

## Objetivo

Depois de construir e explorar o chat, verificar suas regras e seus handlers HTTP com Jest, em TypeScript. Testes determinísticos devem executar sem chave e sem tráfego para o Azure.

Manter os contratos da Spec 01. Se uma regra estiver incorreta, corrigir a implementação e explicar a divergência. Não reescrever o assistente inteiro nem antecipar Promptfoo.

## Estrutura e execução

Criar `tests/unit/*.test.ts`, `tests/integration/*.test.ts`, `tests/support/ScriptedModelClient.ts` e `tests/support/isolamento.ts`. Os testes são **TypeScript** e importam diretamente de `src/`, com os mesmos tipos do código (`ModelClient`, `ContasGateway`, `ResultadoFerramenta`). O `ScriptedModelClient` implementa `ModelClient`, para o compilador acusar qualquer divergência de contrato. Proibido `any` e `@ts-ignore` nos testes.

Instalar `jest` e `@types/jest`, com versões exatas e o lockfile gerado pelo npm. Usar `jest.config.cjs` com `next/jest`, como na aplicação da raiz (o arquivo de configuração é a única exceção a `.ts`); o `next/jest` transforma TypeScript com SWC, então não há `ts-jest`, `dist/` nem build antes dos testes. Não instalar Supertest: o Express saiu do projeto.

`npm test` executa `jest --runInBand` e deve falhar se algum teste falhar. `tsconfig.json` passa a incluir `tests/`, e `npm run typecheck` precisa passar com os testes tipados.

Para a API, chamar as factories de `src/api/chat/handlers.ts` com `Request` e ler a `Response`, por exemplo `criarPostChat(deps)(new Request('http://localhost/api/chat', { method: 'POST', body }))`. `Request` e `Response` são globais no Node 24: não iniciar o Next, não usar porta fixa nem Supertest. Cada teste monta suas dependências (store, `ScriptedModelClient`, trace em memória) do zero, sem importar o estado global de `src/application/contexto.ts`. Se for útil, criar um helper tipado `tests/support/ajuda.ts` (estado novo, parâmetros de turno, respostas de exemplo), sem lógica de aprovação.

**Isolamento obrigatório.** O `next/jest` carrega `.env` e `.env.local` no ambiente dos testes, então `tests/support/isolamento.ts` (em `setupFiles`) remove as variáveis `AZURE_*`, `MODEL_PROVIDER`, `BANCO_*` e `CHAT_CONTAS_*` e substitui `fetch` por um guarda que rejeita qualquer host diferente de `127.0.0.1`. Os testes passam com ou sem `.env` e com ou sem essas variáveis definidas no shell, e nunca leem nem imprimem segredos.

**Único ponto de injeção no código de produção.** Para testar o adaptador Azure sem rede, o `AzureModelClient` recebe um `fetch` opcional como terceiro parâmetro do construtor (`new AzureModelClient(config, timeoutMs, transporte?)`), repassado ao SDK. É a única alteração de produção permitida nesta etapa, salvo correção de defeito encontrada pelos testes.

Um teste de factory não prova a composição da rota nem a comunicação de rede. Por isso, além dos testes, executar o smoke manual com `npm run dev` e `curl` (seção "Smoke e chamada real").

Injetar cliente de modelo, `ContasGateway`, estado, IDs/relógio quando necessário e escrita de trace em diretório temporário. Os testes das ferramentas, do assistente e da API usam `ContasMemoriaGateway` com contas `123456`/`654321` e o inexistente-no-fixture/não autorizado `999999`. Nenhum teste obrigatório exige a aplicação bancária no ar, rede ou porta 3000. Fechar recursos ao final. Não testar o retorno real de um LLM com comparação de string exata.

## Matriz mínima de testes

| Grupo | Comportamento que precisa de evidência |
| --- | --- |
| Consulta | Conta autorizada devolve saldo real do fixture; ausente/indisponível retorna erro definido |
| Gateway HTTP | `ContasHttpGateway` com servidor `node:http` local em porta efêmera (ou `fetch` injetado): `200 {numero, saldo}` em reais vira centavos inteiros; `400 CONTA_INVALIDA` e `404 CONTA_NAO_ENCONTRADA` viram `DADOS_INVALIDOS`; resposta lenta vira `TIMEOUT`; conexão recusada, `5xx` e corpo fora do contrato viram `FONTE_INDISPONIVEL`. Mensagem, URL e corpo da API bancária não aparecem no resultado nem no trace |
| Integração bancária | Com o gateway HTTP, só ocorrem requisições `GET`; `simularTransferencia` faz dois `GET` e nenhum `POST /api/transferencias`; conta não autorizada não gera nenhuma requisição; usar contas de seis dígitos (`123456`/`654321`) |
| Autorização | Conta 999999 é bloqueada mesmo existindo no mapa privado; erro não vaza seu saldo |
| Simulação | 10000/2000 com valor 3000 retorna projeção 7000/5000 e preserva o objeto original |
| Valores | Zero, negativo, fração, string numérica, inteiro inseguro e soma insegura são rejeitados |
| Dados | Conta ausente, conta igual e argumentos extras são rejeitados |
| Saldo insuficiente | Retorna `SALDO_INSUFICIENTE`; nenhum saldo se altera |
| Dispatcher | Nome desconhecido ou `executarTransferencia` é registrado e bloqueado; função não é executada |
| Tool loop | Resultado usa o `tool_call_id` correto; múltiplas chamadas são respondidas e registradas |
| Limite | Cliente que sempre pede ferramenta termina em `runtime_error` ao esgotar rodadas |
| Histórico | Pedido incompleto seguido do destino chega ao modelo com o turno anterior; sessões são isoladas; turno com `infra_error` não entra no histórico; só os 10 últimos turnos completos são mantidos |
| Contexto do modelo | A requisição inicial contém só identidade e contas autorizadas, sem saldos privados; conteúdo externo vai delimitado como não confiável dentro da mensagem do usuário, nunca como `system` |
| Contrato final | JSON correto aprova schema; Markdown, JSON inválido, ação/dados incompatíveis ou campos extras reprovam sem reparo |
| Falhas | Timeout local da ferramenta difere de erro 401/429/timeout do cliente LLM |
| Segredos | Erro de cliente contendo uma chave sintética não a expõe no envelope nem no trace; o trace em arquivo redige a chave conhecida |
| Configuração | Padrões (`fake`, backend `http`, contas `123456`/`654321`); Azure incompleto falha citando só os nomes das variáveis; base Azure inválida (URL completa de endpoint, projeto, query, HTTP, credenciais) e base bancária fora de localhost são rejeitadas |
| Modo fake | Os três exemplos roteirizados passam pelo loop real; simular não altera saldos e consultar depois preserva 10000/2000; entrada fora dos exemplos retorna recusa identificada `DADOS_INVALIDOS` |
| API | Via factories com `Request`/`Response`: sessão nova, exclusão idempotente, 404 de sessão ausente, 400 de input inválido (inclusive JSON malformado e corpo que não é objeto) e 413 de payload grande, lido com limite de bytes no handler (inclusive `Content-Length` declarado acima do limite) |
| Entrada HTTP | Campos `esperado`, `saldosCentavos`, `usuarioId` ou `contasAutorizadas` enviados à rota são rejeitados |
| Saída HTTP | Status 200/502/500 e envelope seguem o contrato comum; 200 não é interpretado como qualidade aprovada |
| Isolamento | Os testes de ferramentas, assistente e API não constroem o cliente Azure; passam com variáveis Azure presentes ou ausentes; qualquer `fetch` externo é bloqueado |

Usar testes parametrizados nos valores inválidos. O objetivo é cobrir regras e limites relevantes, sem multiplicar casos que só repetem a implementação.

## Roteiros do cliente injetado

`ScriptedModelClient` recebe uma sequência explícita de mensagens do assistente e registra as requisições recebidas. Ele não contém lógica de aprovação nem importa o dataset/oráculo. Exemplos de sequências:

- Uma `tool_call` de consulta, seguida de JSON final com saldo.
- JSON pedindo destino, sem ferramentas.
- Ferramenta desconhecida seguida de resposta final válida, para provar que a tentativa permanece no trace.
- Resultado textual com cercas Markdown, para conferir `invalid_output`.
- Erro de transporte, para conferir `infra_error` e sanitização.

Comparar mensagens estruturadas e argumentos nos testes do loop. Para texto livre, conferir apenas propriedades necessárias, sem prometer equivalência semântica a partir dessas verificações.

## Smoke e chamada real

Manter o smoke da etapa 01 separado de `npm test`. A ausência de credenciais nunca deve marcar testes obrigatórios como ignorados. Os testes do adaptador Azure usam transporte/SDK injetado e verificam, sem rede, a montagem da requisição da Responses API (`input` com `function_call`/`function_call_output`, ferramentas planas, `store: false`, sem `reasoning`), a leitura de `function_call` e `output_text` da resposta e o tratamento de erro. Um teste confere que o histórico `tool` volta com o mesmo `call_id` do pedido.

O smoke com `BANCO_BACKEND=http` e a verificação manual contra a aplicação bancária (`npm run dev` da raiz, porta 3000, com as contas `123456` e `654321` já existentes) ficam fora de `npm test`, como o smoke Azure.

Smoke manual das rotas do chat (prova a composição que as factories não provam): com `npm run dev` em `project-chat/`, `curl -X POST localhost:3004/api/sessions`, `curl localhost:3004/api/health` e um `curl -X POST localhost:3004/api/chat` com o `sessionId` retornado e uma frase do modo fake. Registrar no relatório que isso foi feito manualmente.

## Evidência de que os testes detectam defeitos

Passar não basta: é preciso mostrar que a suíte reprova código errado. Depois de a suíte estar verde, introduzir **temporariamente**, um por vez, pelo menos três defeitos no código de `src/`, executar `npm test` e registrar quantos testes falham em cada um:

1. A projeção da simulação soma o valor na origem em vez de subtrair.
2. O resultado da ferramenta volta ao modelo com um `tool_call_id` fixo.
3. A checagem de autorização aceita qualquer conta (ou o limite de corpo de 16 KB é removido).

Restaurar o código depois de cada defeito, conferir que a suíte volta a passar e informar que isso foi um experimento temporário. Sem essa evidência, não declarar a suíte confiável.

## Aceite

```bash
npm test
npm run typecheck
npm run build
npm run smoke -- offline
```

Os quatro comandos devem concluir em ambiente sem credenciais e sem a aplicação bancária em execução. A aprovação significa que as regras e o encadeamento foram verificados com dublês; não representa avaliação de linguagem, robustez do deployment ou taxa de sucesso dos prompts.

Apresentar pelo menos um teste de cálculo, um de autorização e um de falha. Explicar o que cada um comprova e qual pergunta sobre o modelo ainda continua aberta.
