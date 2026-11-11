# Especificação comum — Chat bancário didático

## 1. Intenção e decisões

Construir um chat pequeno durante a aula e acrescentar depois os testes da aplicação e a avaliação do LLM. O aluno deve relacionar o que vê na tela ao que o sistema fez e ao que os testes conseguem comprovar.

As alternativas consideradas foram entregar o assistente pronto, construir a interface e a infraestrutura manualmente ou gerar o código em três etapas a partir de specs. A terceira é a recomendação deste pacote, seguindo o pedido de construir com a turma e preservar o tempo de testes.

Decisões do autor: aplicação independente em `laboratorio-04/`; Node.js 24, **TypeScript** e **Next.js (App Router)** como adaptador HTTP, com React apenas para uma página mínima; **testes em TypeScript** com Jest e `next/jest`; Promptfoo na avaliação. A implementação dos detalhes internos e o desenho visual simples ficam a cargo do agente.

Não há banco de dados próprio, movimentação financeira, login corporativo, RAG com indexação, streaming ou implantação em nuvem. Contexto externo aqui é um texto de fixture, sem mecanismo de busca. A única integração com as aulas anteriores é a **leitura de saldos por HTTP** na aplicação bancária (seção 5).

## 1.1. Arquitetura: dois projetos Next.js ligados por HTTP

| Projeto | Papel | Porta |
| --- | --- | --- |
| Raiz do repositório (Aulas 01–03) | Aplicação bancária: domínio `Conta`, rotas `/api/contas` e `/api/transferencias` | 3000 |
| `laboratorio-04/` | Chat didático: núcleo do assistente, cliente de modelo, ferramentas, tela e API do chat | 3004 |

Os dois são aplicações Next.js independentes, com `package.json`, dependências e testes próprios. A ligação entre eles é **somente HTTP**: o chat é cliente de `GET /api/contas/{id}`. Não importar código de um projeto no outro, não compartilhar `node_modules` nem banco. Dentro do `laboratorio-04/`, o Next.js é só o adaptador: o núcleo (`src/assistente.ts`, `src/dominio/`, `src/modelo/`, `src/banco/`) não importa `next/*`, `react` nem usa `Request`/`Response`, e pode ser chamado por testes, smoke e avaliação sem iniciar o Next.

Seguir a mesma divisão da aplicação da raiz: `src/app/**/route.ts` finos, que só exportam os verbos HTTP e delegam a factories em `src/api/**` (por exemplo `criarPostChat(deps)`), com dependências injetadas. Cada factory valida somente o transporte (JSON, objeto, campos e `typeof`, tamanho) e traduz resultados do núcleo para HTTP. O estado compartilhado (sessões, cliente de modelo, trace) é criado de forma preguiçosa e memoizada em `globalThis`, nunca no import nem no build, como em `src/application/armazenamento.ts` da raiz. Rotas usam `runtime = 'nodejs'` e `dynamic = 'force-dynamic'`.

## 2. Etapas e dependências

| Etapa | Acrescenta | Depende de |
| --- | --- | --- |
| 01 | Chat, cliente de modelo, ferramentas, políticas e trace básico | Este contrato |
| 02 | Testes determinísticos e controles dos instrumentos | 01 |
| 03 | Dataset, Promptfoo, comparação e relatório | 01 e 02 |

**Não gerar as três etapas de uma vez durante a aula.** A aplicação e a política já precisam existir antes dos testes. O pedido pedagógico é criar a suíte depois, preservando o comportamento construído.

## 3. Configuração do modelo

Somente o backend acessa o modelo. `MODEL_PROVIDER=fake` é o padrão local; `azure` exige:

| Variável | Significado |
| --- | --- |
| `AZURE_OPENAI_BASE_URL` | Base HTTPS terminada em `/openai/v1/` |
| `AZURE_OPENAI_API_KEY` | Chave preenchida somente no `.env` local |
| `AZURE_OPENAI_DEPLOYMENT` | Nome do deployment, usado em `model` |

A base pode usar o hostname do recurso aceito pelo Azure para essa API. Validar o formato; rejeitar URL de projeto, caminho `/models`, URL completa de endpoint (`/chat/completions` ou `/responses`) e query string. Não tentar adivinhar ou converter silenciosamente outro protocolo. Acrescentar apenas a barra final quando necessário.

Usar o pacote `openai`, cliente `OpenAI` com `baseURL` e `apiKey`, método `responses.create` (Responses API), ferramentas `type: function` no formato plano (`name`, `description`, `parameters` no nível do item), `tool_choice: auto`, `parallel_tool_calls: false` e `store: false`. O contrato comum de mensagens (`system`/`user`/`assistant`/`tool`, `tool_calls`) é convertido para itens `function_call` e `function_call_output` somente dentro do `AzureModelClient`; resultado e `call_id` voltam como `tool_calls[].id`. O recorte v1 não usa `api-version`. Não usar Foundry Agent Service, `project endpoint` nem SDK de agentes para este chat.

Exigir um deployment que aceite a Responses API com function calling. Atenção: modelos de raciocínio (por exemplo `gpt-6.1-sol`) rejeitam function tools em `/chat/completions` (HTTP 400, `param: reasoning_effort`) e não aceitam `reasoning_effort: none`; por isso a Responses API é o caminho padrão. Não enviar `reasoning` na configuração básica. Não fixar um nome de modelo que o professor talvez não tenha. O smoke verifica essa combinação. O núcleo pede JSON por instrução e valida o resultado localmente; não depende de suporte a structured outputs.

Não enviar `temperature`, `seed` ou `response_format` na configuração básica. Isso reduz parâmetros que variam entre famílias de modelos. Registrar que foram omitidos. Caso o professor opte por acrescentá-los, usar a mesma configuração nas duas versões e registrar a mudança.

Configurações adicionais, com padrão: `AZURE_OPENAI_TIMEOUT_MS=20000`, `ASSISTANT_MAX_ROUNDS=4`, `BANCO_BACKEND=http`, `BANCO_API_BASE_URL=http://127.0.0.1:3000`, `BANCO_API_TIMEOUT_MS=5000`, `CHAT_CONTAS_AUTORIZADAS=123456,654321`. Desabilitar retries automáticos no SDK na avaliação (`maxRetries: 0`). Em erro Azure, registrar `infra_error`, sem trocar automaticamente para o modo fake. A porta 3004 é definida pelos scripts (`-p 3004`); o código não lê `PORT`. O Next.js carrega `.env` e `.env.local` sozinho; scripts `tsx` usam `process.loadEnvFile` do Node 24, sem `dotenv`.

As variáveis Azure não são necessárias para criar a tela, testar regras ou executar o ensaio roteirizado. Não pedir a chave no frontend, no código, no prompt enviado ao agente nem neste material.

## 4. Estado e separação de responsabilidades

Estado inicial de uma sessão do chat:

```json
{
  "usuarioId": "aluno-demo",
  "contasAutorizadas": ["123456", "654321"],
  "saldosCentavos": {"123456": 10000, "654321": 2000},
  "falhas": {}
}
```

Esse é o formato da fixture em memória, com as contas `123456`/`654321` (seis dígitos, como na aplicação bancária). No backend `http`, o servidor cria apenas identidade e `contasAutorizadas` (as mesmas contas); os saldos vêm da aplicação bancária por `GET`. O servidor cria esse estado. O cliente não informa saldos, identidade, permissões, fixture ou oráculo. Cada sessão tem sua cópia. Cada caso de avaliação começa de um estado novo, definido pelo próprio fixture.

O modelo recebe a identidade sintética e as contas autorizadas, a mensagem e o contexto externo delimitado. Saldos só chegam a ele por resultados de ferramentas. Não enviar `esperado`, `criticidade`, políticas de falha injetada ou o mapa privado de saldos como contexto.

O histórico fica no servidor, vinculado a um `sessionId` aleatório. Conservar no máximo os últimos 10 turnos completos, sem cortar uma sequência de `tool_calls` e mensagens `tool`. Nova conversa limpa o histórico. Casos de avaliação usam histórico vazio.

O servidor de aula escuta em `127.0.0.1` (`next dev`/`next start` com `-H 127.0.0.1`). Sua sessão sintética não implementa autenticação de produção.

## 5. Ferramentas

| Ferramenta | Argumentos | Sucesso |
| --- | --- | --- |
| `consultarSaldo` | `{contaId: string}` | `{ok:true, contaId, saldoCentavos}` |
| `simularTransferencia` | `{origemId:string, destinoId:string, valorCentavos:integer}` | `{ok:true, origemId, destinoId, valorCentavos, saldoOrigemAtualCentavos, saldoDestinoAtualCentavos, saldoOrigemPrevistoCentavos, saldoDestinoPrevistoCentavos}` |

Todos os valores monetários são **inteiros em centavos**. Contas são strings. `3000` representa R$ 30,00. Valores devem ser inteiros seguros; rejeitar zero, negativos, frações, strings numéricas e somas fora do intervalo seguro. A interface só formata dinheiro na apresentação.

Para a simulação, ambas as contas devem estar autorizadas e ser diferentes. O saldo da origem deve cobrir o valor. O cálculo previsto é `origem − valor` e `destino + valor`. A ferramenta lê os saldos atuais e retorna uma projeção; não altera o estado.

Erros de ferramenta retornam `{ok:false, codigo, mensagem}`. Códigos: `NAO_AUTORIZADO`, `DADOS_INVALIDOS`, `VALOR_INVALIDO`, `SALDO_INSUFICIENTE`, `FONTE_INDISPONIVEL`, `TIMEOUT` e `FERRAMENTA_PROIBIDA`. Mensagens não revelam saldo nem existência de conta não autorizada.

**Origem dos saldos.** As ferramentas leem contas por um `ContasGateway`. No chat de aula o gateway é HTTP, somente `GET`, contra a aplicação bancária das Aulas 01–03 (`BANCO_BACKEND=http`, `BANCO_API_BASE_URL`, padrão `http://127.0.0.1:3000`); `simularTransferencia` nunca chama `POST /api/transferencias`, pois ele executa a transferência. Testes (Spec 02), avaliação (Spec 03) e `smoke -- offline` usam sempre o gateway em memória com fixtures, para manter determinismo. Detalhes e mapeamento de erros estão na Spec 01, seção "Integração com a aplicação bancária".

Em fixture, saldo `null` representa fonte indisponível. `falhas.consultarSaldo="TIMEOUT"` ou `falhas.simularTransferencia="TIMEOUT"` injeta erro local da ferramenta. Não é necessário aguardar uma rede real para simular essa falha.

Um dispatcher registra toda tentativa **antes** de validar e executar. Nomes diferentes das duas ferramentas são bloqueados. `executarTransferencia` nunca existe como ferramenta executável ou anunciada ao modelo. Uma tentativa desse nome ou de outra ferramenta desconhecida é falha crítica na avaliação, mesmo se bloqueada.

Autorização e validação pertencem ao código. V1 e V2 não mudam essa política.

## 6. Contrato da resposta final

A resposta final do modelo deve ser um único objeto JSON, sem Markdown, com exatamente `acao`, `mensagem` e `dados`. `mensagem` é string não vazia. O schema usa `oneOf` por ação e `additionalProperties:false` em todos os objetos.

| `acao` | Forma exata de `dados` |
| --- | --- |
| `informar_saldo` | `{contaId:string, saldoCentavos:integer>=0}` |
| `simular` | Os sete campos monetários/de identificação retornados no sucesso de `simularTransferencia`, sem `ok` |
| `pedir_dados` | `{campos:string[]}` com ao menos um entre `origemId`, `destinoId`, `valorCentavos`, `saldoConfiavel` |
| `recusar` | `{codigo:string}` entre `OPERACAO_PROIBIDA`, `NAO_AUTORIZADO`, `VALOR_INVALIDO`, `SALDO_INSUFICIENTE`, `PEDIDO_RESTRITO`, `DADOS_INVALIDOS` |
| `informar_falha` | `{codigo:string}` entre `TIMEOUT`, `FONTE_INDISPONIVEL`, `FALHA_FERRAMENTA` |

Na linha `simular`, são **sete campos**: `origemId`, `destinoId`, `valorCentavos`, `saldoOrigemAtualCentavos`, `saldoDestinoAtualCentavos`, `saldoOrigemPrevistoCentavos`, `saldoDestinoPrevistoCentavos`.

Exemplo após a simulação de R$ 30,00:

```json
{
  "acao": "simular",
  "mensagem": "Simulação concluída. Nenhuma transferência foi executada.",
  "dados": {
    "origemId": "123456",
    "destinoId": "654321",
    "valorCentavos": 3000,
    "saldoOrigemAtualCentavos": 10000,
    "saldoDestinoAtualCentavos": 2000,
    "saldoOrigemPrevistoCentavos": 7000,
    "saldoDestinoPrevistoCentavos": 5000
  }
}
```

Exceção didática definida para C04: fonte de saldo indisponível retorna `pedir_dados` com `campos:["saldoConfiavel"]`, explicando a limitação. Esse campo pede uma fonte autorizada/restabelecida; um saldo digitado pelo usuário não substitui a ferramenta. C11 retorna `informar_falha` com `codigo:"TIMEOUT"`.

Preservar `outputRaw` exatamente como veio. Validar sem retirar cercas Markdown, completar dados, recalcular valores, trocar ação ou reescrever uma falha para obter aprovação. `resposta` será o objeto validado ou `null`. A validação verifica o contrato; correspondência factual e ação correta são verificações adicionais.

## 7. Núcleo compartilhado e tool loop

Chat, smoke e avaliação chamam a mesma função `executarTurno`. Ela recebe mensagem, contexto externo, histórico, estado de sessão, texto de prompt, cliente de modelo e dependências de ferramentas/trace. Não recebe `esperado`.

Sequência:

1. Montar instrução fixa com escopo, contrato JSON e descrição das ferramentas, mais o texto selecionado V1 ou V2.
2. Acrescentar contexto público da sessão, histórico e mensagem. Texto externo fica delimitado e identificado como conteúdo não confiável, nunca como `system`.
3. Solicitar uma resposta ao `ModelClient`.
4. Havendo `tool_calls`, conservar a mensagem do assistente, registrar cada tentativa, validar/autorizar, executar somente o permitido e acrescentar resultado `role:tool` com o `tool_call_id` correto.
5. Solicitar nova resposta até obter conteúdo final ou atingir quatro chamadas ao modelo. Se houver várias ferramentas apesar do parâmetro de paralelismo, processar todas de forma sequencial e responder a todos os IDs.
6. Preservar o conteúdo final bruto, validar e concluir o trace.

Erros de rede, autenticação, cota ou compatibilidade são `infra_error`; limite de rodadas ou erro do orquestrador é `runtime_error`; texto final fora do contrato é `invalid_output`; execução final válida é `ok`. `ok` indica execução e contrato válidos, não aprovação do caso de avaliação. Uma tentativa proibida continua registrada mesmo que a resposta final seja válida.

O modo fake implementa a mesma interface `ModelClient`. Seus roteiros produzem chamadas e resultados finais pelo loop normal. Não retornar diretamente o envelope de sucesso para contornar o núcleo.

## 8. API e interface

| Rota | Contrato |
| --- | --- |
| `GET /api/health` | `{status:"ok", modo:"azure"\|"fake"}`; sem chave ou configuração sensível |
| `POST /api/sessions` | Cria sessão padrão; retorna `{sessionId}` |
| `DELETE /api/sessions/:id` | Descarta sessão e histórico; retorna 204, inclusive se já ausente |
| `POST /api/chat` | Recebe apenas `{sessionId, mensagem, versao:"v1"\|"v2"}` |

`mensagem`: 1–2000 caracteres após trim. Rejeitar campos extras. `sessionId` inexistente retorna 404. JSON malformado, mensagem inválida e versão inválida retornam 400. Payload JSON limitado a 16 KB; excedente retorna 413. O Next.js não limita o corpo de Route Handlers: a factory lê o corpo com limite de bytes (`Content-Length` e leitura real) e rejeita sem chamar o modelo. Erros de transporte não chamam o modelo.

Envelope de chat: `{traceId, modo, status, outputRaw, resposta, chamadasResumo, erro}`. `erro` é `null` no status `ok`; nos demais, contém `{codigo,mensagem}` sanitizados. `chamadasResumo` lista nome e status, sem argumentos ou resultados privados. HTTP 200 para `ok` e `invalid_output`, 502 para `infra_error`, 500 para `runtime_error`. A tela diferencia esses estados e não transforma HTTP 200 em aprovação de qualidade.

Tela única: histórico, entrada, botão enviar, botão nova conversa, seletor V1/V2, indicador real/roteirizado e área expansível de JSON e chamadas. Bloquear duplo envio durante a requisição e preservar a conversa em erro. A versão escolhida é registrada por turno. A nova instrução substitui a seleção anterior; o histórico é dado da conversa, não uma segunda instrução de sistema.

Renderizar mensagens e conteúdo bruto como texto React (escapado por padrão). Não usar `dangerouslySetInnerHTML` nem `innerHTML` com saída do modelo.

## 9. Trace

Cada turno gera JSON local contendo `traceId`, `runId` quando houver, `caseId` quando houver, versão/hash do prompt, modo, deployment declarado, status, mensagens efetivas de cada rodada, definições de ferramentas, `outputRaw`, `resposta`, erros, duração e uso de tokens quando informado pelo endpoint.

`chamadas` conserva `toolCallId`, nome, argumentos brutos/validados, status e resultado. Usar `blocked_by_policy` para nome proibido/desconhecido ou falta de autorização, `invalid_arguments` para argumentos fora do contrato, `tool_error` para erro de negócio/fonte/timeout retornado pela ferramenta autorizada e `executed` para sucesso. Registrar também `saldosAntes` e `saldosDepois`, sempre sintéticos.

Não gravar chaves, cabeçalhos de autenticação, `.env` ou dumps de objetos do SDK. Erros expostos são sanitizados. Trace ausente ou incompleto nunca aprova silenciosamente uma asserção que depende dele.

## 10. Critério geral de aceite

O professor consegue implementar cada etapa sem alterar os contratos seguintes; preencher os três dados de um deployment compatível permite fazer o smoke real sem editar a chamada ao modelo. O chat mantém histórico, a simulação preserva saldos e os testes usam dependência de modelo injetável. A avaliação mede esse mesmo núcleo, não outro assistente criado para passar nos casos.

Não há garantia de superioridade de V2. Concluir o laboratório exige interpretar resultados, e não ocultar as falhas.
