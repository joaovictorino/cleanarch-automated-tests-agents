# SPEC-API-001 — Contrato HTTP de transferências

**Versão:** 2.0  
**Etapa:** 02 — TDD da API  
**Dependências:** `specs/criacao-nextjs.md`, `specs/transferencia.md` (BANK-SPEC-001). 

## 1. Estória de usuário

**Como** cliente de uma instituição financeira, **quero** solicitar uma transferência bancária por HTTP **para** receber um comprovante e a confirmação do processamento.

**Importante:** esta especificação acrescenta **um contrato de transporte** ao domínio da Aula 01, sem substituí-lo. A API deve utilizar as classes e métodos já existentes.

## 2. Requisição e resposta

**Rota:** `POST /api/transferencias`. Recebe JSON:

```json
{"contaOrigem":"123456","contaDestino":"654321","valor":300}
```

- Contas são **strings**, nunca números, para preservar zeros à esquerda.
- `valor` é um número JSON finito, positivo, com no máximo duas casas decimais, em reais (BANK-SPEC-001 DT01/DT06).
- Campos adicionais podem ser ignorados; não devem mudar o resultado.
- A ausência de `Content-Type` por si só não constitui um novo erro contratual nesta aula: o corpo ainda deve ser JSON válido. Não acrescentar `415` sem decisão do professor.

**Sucesso, HTTP 201:**

```json
{"comprovante":"123456"}
```

A resposta é JSON, sem dados das contas, saldos ou stack traces. O comprovante deve corresponder ao retornado pelo domínio e respeitar `^[0-9]{6}$`.

**Erro, exemplo HTTP 422:**

```json
{"erro":"SALDO_INSUFICIENTE"}
```

## 3. Tabela normativa de erros

| Condição | HTTP | Corpo JSON | Quem detecta |
| --- | ---: | --- | --- |
| JSON inválido, `null`, array ou outro corpo que não seja objeto JSON | 400 | `{"erro":"REQUISICAO_INVALIDA"}` | Handler |
| `contaOrigem` ou `contaDestino` ausente ou não string | 400 | `{"erro":"CONTA_INVALIDA"}` | Handler (tipo) |
| `contaOrigem` ou `contaDestino` string com formato diferente de seis dígitos ASCII | 400 | `{"erro":"CONTA_INVALIDA"}` | Domínio (`NumeroConta` → `ErroNegocio`) |
| `valor` ausente ou não `number` | 400 | `{"erro":"VALOR_INVALIDO"}` | Handler (tipo) |
| `valor` zero, negativo, não finito ou com mais de duas casas decimais | 400 | `{"erro":"VALOR_INVALIDO"}` | Domínio (`Conta` → `ErroNegocio`) |
| Mesma conta (strings idênticas e válidas) | 422 | `{"erro":"MESMA_CONTA"}` | Domínio (`TransferenciaValor`) |
| Conta com formato válido que não está no cadastro em memória | 404 | `{"erro":"CONTA_NAO_ENCONTRADA"}` | Adaptador de transferência |
| Valor maior que saldo disponível | 422 | `{"erro":"SALDO_INSUFICIENTE"}` | Domínio (`Conta.sacar`) |
| Falha inesperada / erro interno sem classificação contratual | 500 | `{"erro":"ERRO_INTERNO"}` | Handler (erro não classificado) |

**Ordem de precedência quando há vários erros na mesma entrada:** (1) estrutura JSON; (2) formato das contas; (3) formato/validade do valor; (4) mesma conta; (5) existência das contas; (6) regras de transferência no domínio; (7) falhas internas. É uma **decisão didática específica da Aula 02** e deve ser mantida pelos testes; ela não estava definida na Aula 01.

**Erros e ausência de efeitos:** toda resposta de erro deve deixar os dois saldos sem alteração. Não devolver mensagens técnicas, stack traces, nomes de classes ou valores sensíveis na resposta HTTP.

## 4. Contratos de implementação (sem implementação pronta)

Uma factory testável sem servidor deverá existir em:

```ts
// src/api/transferencias/handler.ts
export type DadosTransferencia = {
  contaOrigem: string;
  contaDestino: string;
  valor: number;
};

export type OperacaoTransferencia = {
  executar(dados: DadosTransferencia):
    | { comprovante: string }
    | Promise<{ comprovante: string }>;
};

export function criarPostTransferencias(
  operacao: OperacaoTransferencia,
): (request: Request) => Promise<Response>;
```

O código apresentado acima é o **contrato público a implementar**, não a solução. Mantenha esses nomes para tornar os testes independentes da organização do domínio anterior. É permitido separar os tipos em arquivo próprio apenas se houver justificativa de legibilidade.

Em `src/app/api/transferencias/route.ts`, exportar `POST` que delega à factory. A ligação (`composition root`) cria **um adaptador** que localiza contas e chama `TransferenciaValor.transferir` real. Ela recebe `contasDemonstracao` do módulo compartilhado `src/application/estado-contas.ts`, o **mesmo Map inicialmente vazio** das rotas de contas. Para o teste manual, criar primeiro `123456`/1000 e `654321`/200 via `POST /api/contas`. **Não confundir com persistência ou estado compartilhado confiável**; o endpoint demonstrativo pode perder estado ao reiniciar e não suporta concorrência.

Para facilitar a compatibilidade entre agentes, a composição pode seguir **este contrato público padronizado**:

```ts
// src/application/transferencias/operacao.ts
// Importe Conta e OperacaoTransferencia dos caminhos REAIS do projeto.
export function criarOperacaoTransferencia(
  contas: ReadonlyMap<string, Conta>,
  gerarCodigo?: () => string,
): OperacaoTransferencia;
```

Ele é um **contrato de fábrica**, não a implementação. O aluno deve criar o arquivo apenas quando iniciar a etapa de integração, e não no primeiro RED do handler. `ReadonlyMap` impede que o adaptador adicione/remova contas arbitrariamente, mas os objetos `Conta` continuam mutáveis pelo domínio. Ajuste somente o import de `Conta` ao projeto real.

O caso de uso/adaptador deve:

1. Buscar as duas contas no cadastro fornecido (Map injetável nos testes).
2. Retornar o erro semântico `CONTA_NAO_ENCONTRADA` quando uma não existir.
3. Invocar a transferência **já implementada na Aula 01**; não copiar sua lógica.
4. Retornar `{ comprovante: recibo.codigo }`.
5. Aceitar gerador de comprovante injetável para testes determinísticos e não alterar a assinatura pública do domínio.

**Mapeamento de erro:** aplicar `specs/erros-aplicacao.md` antes desta etapa. Reconhecer ErroNegocio e os códigos previstos na tabela; preservar mensagens e testes anteriores do domínio. Erro desconhecido, recibo inválido ou falha de crédito por limite máximo resultam em `500 ERRO_INTERNO`, sem expor mensagem técnica e com saldos preservados. Não interpretar `Error.message` nem transformar todo erro em 400.

**Matriz de responsabilidade (normativa).** O handler só verifica JSON, objeto, presença e `typeof`. Formato das contas, escala/sinal/finitude do valor, mesma conta e saldo são regras do domínio, chegam como `ErroNegocio` e são traduzidas pela lista de códigos do endpoint. É vetado no handler: regex de conta, `Math.round`, `* 100`, `Number.isFinite`, comparações monetárias e `contaOrigem === contaDestino`.

**Precedência.** A ordem da §3 (formato das contas → valor → mesma conta → existência → saldo) é garantida por `criarOperacaoTransferencia`, construindo `NumeroConta` e validando o valor com as classes reais antes de consultar o cadastro, e não por pré-validação no handler. Se isso exigir exportar uma checagem do domínio ou alterá-lo, registre a decisão e peça autorização antes.

**Testes com mock.** Para formato de conta e valor numérico inválido, o mock de `executar` lança `ErroNegocio(código)` e o teste verifica o mapeamento HTTP. Os mesmos casos de `API-04/05/06/08/12` rodam depois com o adaptador real. "Operação não acionada" vale apenas para falhas de estrutura/tipo.

**Validação no limite HTTP x domínio:** a camada HTTP verifica os tipos e campos do contrato, mas a autoridade sobre a movimentação e seus invariantes permanece no domínio. Uma checagem de formato na borda não justifica duplicar lógica de saldo, saque, depósito, arredondamento ou transferência.

## 5. Dados padronizados e critérios de aceite

Fixture de integração, recriada antes de **cada teste**:

- Conta de origem: `123456`, saldo inicial `1000`.
- Conta de destino: `654321`, saldo inicial `200`.
- Gerador determinístico de comprovante: `() => '123456'`.
- Conta inexistente: `999999` (identificador **válido**, sem cadastro).
- Conta malformada: `12345` (cinco dígitos).

| ID | Situação | Status e resposta | Estado esperado |
| --- | --- | --- | --- |
| API-01 | Transferir 300 | `201`, comprovante `123456` | Origem 700; destino 500 |
| API-02 | Transferir exatamente 1000 | `201`, comprovante válido | Origem 0; destino 1200 |
| API-03 | Transferir 1001 | `422 SALDO_INSUFICIENTE` | Origem 1000; destino 200 |
| API-04 | Valor `0` e `-1` (`test.each`) | `400 VALOR_INVALIDO` | Sem alterações; com mock, `executar` lança `ErroNegocio(VALOR_INVALIDO)`; com adaptador real, a `Conta` rejeita |
| API-05 | Valor `"300"`, `null`, `1.255`, campo omitido | `400 VALOR_INVALIDO` | Sem alterações |
| API-06 | `12345` e `1234567` (e conta em número) | `400 CONTA_INVALIDA` | Sem alterações |
| API-07 | Conta `999999` não cadastrada | `404 CONTA_NAO_ENCONTRADA` | Sem alterações |
| API-08 | Origem igual a destino `123456` | `422 MESMA_CONTA` | Sem alterações |
| API-09 | Corpo `{` (malformado), `null`, `[]` | `400 REQUISICAO_INVALIDA` | Sem alterações |
| API-10 | Transferir `0.29` e usar conta `001234` cadastrada no teste | `201` | Precisão de centavos e zero à esquerda preservados |
| API-11 | Serviço lança erro inesperado com mensagem técnica | `500 ERRO_INTERNO` | Mensagem técnica **não** exposta |
| API-12 | a) Corpo JSON malformado; b) objeto válido com conta inválida e valor inválido | a) `400 REQUISICAO_INVALIDA`; b) `400 CONTA_INVALIDA` | Aplicar precedência, nenhuma execução de negócio |
| API-13 | Gerador devolve código de comprovante inválido | `500 ERRO_INTERNO` | Ambos os saldos inalterados (BANK-SPEC-001 DT07) |

**Observação sobre API-10:** o aluno pode usar uma fixture isolada alternativa. Não precisa criar a conta `001234` no cadastro demonstrativo global.

## 6. Estratégia de testes e evidências

- Primeiro RED: teste `MOCK-01` da factory (arquivo ainda ausente), baseado em `specs/mocks-e-integracao.md`.
- Primeiro GREEN: factory que retorna `201` delegando a `operacao.executar` **sem implementar movimentação**.
- Iterar um cenário por vez: validações HTTP, respostas de erro, integração com as classes reais.
- Suítes HTTP usam `Request`/`Response` globais do Node.js 24 em `testEnvironment: 'node'`; **não** iniciar Next.js para esses testes.
- Verificar manualmente a rota com `curl` após concluir a composição; isso não substitui teste E2E nem os testes do handler.

## 7. Definição de pronto

`API-01..13` cobertos ou lacunas explicitadas, `npm test`, `npm run typecheck` e `npm run build` aprovados, testes antigos preservados e relatório de erros/decisões apresentado. **Não** construir UI nem avançar automaticamente para a próxima atividade.


## 8. Complementos da revisão 2.0

A fixture 1000/200 existe somente nos testes isolados e nas contas criadas explicitamente no smoke manual. Não pré-carregar o cadastro global. No servidor demonstrativo, o gerador padrão pode ser aleatório; somente os testes usam comprovante fixo.

As guardas HTTP de tipo, finitude, positividade e precisão do valor protegem o contrato JSON. Elas não substituem a autoridade de Conta sobre os invariantes nem autorizam duplicar saldo, débito, crédito, arredondamento ou rollback na API.
