# Spec 02 — Acrescentar testes da aplicação

## Objetivo

Depois de construir e explorar o chat, verificar suas regras com Jest e sua API com Supertest. Testes determinísticos devem executar sem chave e sem tráfego para o Azure.

Manter os contratos da Spec 01. Se uma regra estiver incorreta, corrigir a implementação e explicar a divergência. Não reescrever o assistente inteiro nem antecipar Promptfoo.

## Estrutura e execução

Criar `tests/unit/*.test.cjs`, `tests/integration/*.test.cjs`, `tests/support/ScriptedModelClient.cjs` e configuração Jest. Os testes usam JavaScript CommonJS contra o código TypeScript já compilado em `dist/`; não é necessário `ts-jest`.

`npm test` deve executar build e depois Jest, serialmente (`--runInBand`). O comando de testes deve falhar se build ou testes falharem. Usar `createApp` diretamente com Supertest, sem iniciar um servidor global e sem porta fixa.

Injetar cliente de modelo, estado, IDs/relógio quando necessário e escrita de trace em diretório temporário. Fechar recursos ao final. Não testar o retorno real de um LLM com comparação de string exata.

## Matriz mínima de testes

| Grupo | Comportamento que precisa de evidência |
| --- | --- |
| Consulta | Conta autorizada devolve saldo real do fixture; ausente/indisponível retorna erro definido |
| Autorização | Conta 999999 é bloqueada mesmo existindo no mapa privado; erro não vaza seu saldo |
| Simulação | 10000/2000 com valor 3000 retorna projeção 7000/5000 e preserva o objeto original |
| Valores | Zero, negativo, fração, string numérica, inteiro inseguro e soma insegura são rejeitados |
| Dados | Conta ausente, conta igual e argumentos extras são rejeitados |
| Saldo insuficiente | Retorna `SALDO_INSUFICIENTE`; nenhum saldo se altera |
| Dispatcher | Nome desconhecido ou `executarTransferencia` é registrado e bloqueado; função não é executada |
| Tool loop | Resultado usa o `tool_call_id` correto; múltiplas chamadas são respondidas e registradas |
| Limite | Cliente que sempre pede ferramenta termina em `runtime_error` ao esgotar rodadas |
| Histórico | Pedido incompleto seguido do destino chega ao modelo com o turno anterior; sessões são isoladas |
| Contrato final | JSON correto aprova schema; Markdown, JSON inválido, ação/dados incompatíveis ou campos extras reprovam sem reparo |
| Falhas | Timeout local da ferramenta difere de erro 401/429/timeout do cliente LLM |
| Segredos | Erro de cliente contendo uma chave sintética não a expõe no envelope nem no trace |
| API | Sessão nova, exclusão idempotente, 404 de sessão ausente, 400 de input inválido e 413 de payload grande |
| Entrada HTTP | Campos `esperado`, `saldosCentavos`, `usuarioId` ou `contasAutorizadas` enviados à rota são rejeitados |
| Saída HTTP | Status 200/502/500 e envelope seguem o contrato comum; 200 não é interpretado como qualidade aprovada |
| Isolamento | Os testes não constroem o cliente Azure e não exigem suas variáveis |

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

Manter o smoke da etapa 01 separado de `npm test`. A ausência de credenciais nunca deve marcar testes obrigatórios como ignorados. Os testes do adaptador Azure usam transporte/SDK injetado e verificam montagem da requisição e tratamento de erro, sem rede.

## Aceite

```bash
npm test
npm run typecheck
npm run smoke -- offline
```

Os três comandos devem concluir em ambiente sem credenciais. A aprovação significa que as regras e o encadeamento foram verificados com dublês; não representa avaliação de linguagem, robustez do deployment ou taxa de sucesso dos prompts.

Apresentar pelo menos um teste de cálculo, um de autorização e um de falha. Explicar o que cada um comprova e qual pergunta sobre o modelo ainda continua aberta.
