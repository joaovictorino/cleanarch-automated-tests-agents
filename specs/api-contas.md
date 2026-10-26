# SPEC-API-002 — Cadastro, listagem e consulta de contas por identificador

**Versão:** 1.0  
**Etapa:** 02 — TDD dos endpoints de contas  
**Dependências:** `specs/transferencia.md` (BANK-SPEC-001), `specs/criacao-nextjs.md`.  
**Natureza:** especificação de comportamento e de contratos públicos; **não é implementação pronta**.

## 1. Objetivo e relação com a Aula 01

**Como** cliente de uma instituição financeira, **quero** cadastrar uma conta bancária com saldo inicial, listar as contas cadastradas e consultar uma conta pelo identificador **para** verificar seus dados e acompanhar o saldo de operações realizadas.

A Aula 01 já define a criação de objetos `Conta`, seu identificador de seis dígitos e as regras de validação monetária. A Aula 02 acrescenta um **cadastro em memória** e uma camada HTTP. Não alterar `Conta` para implementar HTTP, não recriar a regra de validação monetária e não introduzir banco de dados.

O **ID público é o próprio `numero`** da conta, preservado como string; não criar UUID, identificador sequencial, propriedade `id` adicional ou campo `titular`. A decisão de como cadastrar e responder a requisições pertence somente a esta especificação. Não adicionar saque/depósito via API nesta aula.

## 2. Endpoints e exemplos normativos

### 2.1. POST /api/contas — criar conta

Requisição JSON, campos obrigatórios:

```http
POST /api/contas
Content-Type: application/json

{"numero":"123456","saldoInicial":1000}
```

**Sucesso — HTTP 201:**

```json
{"numero":"123456","saldo":1000}
```

Incluir o cabeçalho `Location: /api/contas/123456`. A conta criada deve passar a existir **apenas uma vez** no cadastro compartilhado, e o saldo retornado deve ser o saldo do objeto real `Conta`.

- `numero` é uma **string de exatamente seis dígitos ASCII** (`^[0-9]{6}$`), inclusive zeros à esquerda.
- `saldoInicial` é um **number JSON** finito, maior ou igual a zero e com até duas casas decimais, conforme BANK-SPEC-001 DT01, DT02 e DT06. Saldo inicial zero **é válido**.
- Campos adicionais podem ser ignorados. Não criar contrato de `titular`, `agencia` ou `tipo`.
- Se `Content-Type` estiver ausente mas o corpo for JSON válido, a ausência do cabeçalho não causa erro específico; não criar HTTP 415 nesta aula.
- Valor monetário é fornecido em reais, não centavos inteiros. Não arredondar entradas inválidas para torná-las válidas.
- Se a conta já existir, a requisição falha sem substituir a instância, modificar o saldo existente ou inserir outro registro.

### 2.2. GET /api/contas — listar contas

**Sucesso — HTTP 200:**

```json
{"contas":[{"numero":"001234","saldo":0},{"numero":"123456","saldo":1000}]}
```

Com cadastro vazio, a resposta **exata** é `{"contas":[]}`. A lista inclui todas as contas do cadastro atual, com **ordenação crescente lexicográfica pelo número em string** e cada item contendo **somente** `numero` e `saldo`. A resposta deve refletir operações anteriores no mesmo cadastro, inclusive transferências.

Não oferecer paginação, filtros, consulta em banco ou parâmetros de ordenação nesta aula. Parâmetros de query extras não modificam o resultado.

### 2.3. GET /api/contas/{id} — consultar conta

O `id` na URL é o número da conta, uma string de seis dígitos. No Next.js, a rota fica em `src/app/api/contas/[id]/route.ts`.

```http
GET /api/contas/123456
```

**Sucesso — HTTP 200:**

```json
{"numero":"123456","saldo":1000}
```

A resposta deve refletir o **saldo corrente**. A conta com número `001234` é consultada por `/api/contas/001234`, sem converter o parâmetro para número. Consultar não altera o cadastro nem os saldos.

## 3. Tabela normativa de erros

O corpo de erro segue **um único formato**: `{"erro":"CODIGO"}`. Não devolver mensagens internas, stack traces nem instâncias de domínio.

| Endpoint | Condição | HTTP | Código |
| --- | --- | ---: | --- |
| POST | JSON malformado, array, `null` ou qualquer corpo que não seja objeto JSON | 400 | `REQUISICAO_INVALIDA` |
| POST | `numero` ausente, não string ou formato diferente de seis dígitos ASCII | 400 | `CONTA_INVALIDA` |
| POST | `saldoInicial` ausente, tipo incorreto, negativo, não finito ou precisão acima de duas casas | 400 | `SALDO_INVALIDO` |
| POST | Número válido já cadastrado | 409 | `CONTA_JA_EXISTE` |
| GET por ID | Identificador da URL diferente de seis dígitos ASCII | 400 | `CONTA_INVALIDA` |
| GET por ID | Número bem formado, porém não cadastrado | 404 | `CONTA_NAO_ENCONTRADA` |
| Qualquer um | Falha técnica inesperada, não classificada como erro de contrato/domínio | 500 | `ERRO_INTERNO` |

**Precedência para POST com múltiplos erros:** (1) estrutura JSON; (2) `numero`; (3) `saldoInicial`, incluindo validação monetária da `Conta`; (4) duplicidade; (5) falha inesperada. É uma decisão didática da Aula 02. Ex.: número inválido e saldo negativo retorna `CONTA_INVALIDA`; número duplicado e saldo inválido retorna `SALDO_INVALIDO`.

**Ausência de efeitos:** toda requisição rejeitada deve preservar a quantidade de contas, os dados e saldos das contas previamente cadastradas. GET, seja sucesso ou falha, não altera estado.

Para testes de valores não finitos, lembre-se de que JSON puro não representa `NaN` e `Infinity`: `JSON.stringify` os transforma em `null` e uma palavra literal `NaN` no corpo é JSON inválido. Os testes devem verificar o efeito real do protocolo.

## 4. Contratos públicos mínimos para implementação incremental

Implementar factories testáveis diretamente com `Request` e `Response` da Web API, **sem iniciar Next.js**. Os nomes abaixo são os contratos necessários aos testes; os arquivos só devem ser criados quando a respectiva etapa for autorizada.

```ts
// src/api/contas/handlers.ts — contrato a implementar
export type DadosCriacaoConta = { numero: string; saldoInicial: number };
export type ContaDTO = { numero: string; saldo: number };

export type OperacoesContas = {
  criar(dados: DadosCriacaoConta): ContaDTO | Promise<ContaDTO>;
  listar(): ContaDTO[] | Promise<ContaDTO[]>;
  consultar(id: string): ContaDTO | undefined | Promise<ContaDTO | undefined>;
};

export function criarPostContas(
  operacoes: OperacoesContas,
): (request: Request) => Promise<Response>;

export function criarGetContas(
  operacoes: OperacoesContas,
): (request: Request) => Promise<Response>;

export function criarGetContaPorId(
  operacoes: OperacoesContas,
): (request: Request, id: string) => Promise<Response>;
```

- O handler valida contrato HTTP (JSON, tipos e formato de ID), chama uma operação injetada e traduz resultados/erros; **não** instancia o domínio nem mantém um `Map` próprio.
- A **ordenação da resposta GET lista** é responsabilidade da factory HTTP `criarGetContas` (ordene uma cópia dos DTOs recebidos de `listar()`), para que `CMOCK-06` passe mesmo com mock devolvendo registros fora de ordem; a regra não pertence a `Conta`.
- O adaptador `src/application/contas/operacoes.ts` deve exportar `criarOperacoesContas(contas: Map<string, Conta>): OperacoesContas`, usando o `Conta` **real** da Aula 01. O `Map` é um fake de armazenamento em memória; não é banco de dados.
- Criar requer **validar/construir `Conta` antes de inserir**; a inserção ocorre somente depois de todas as validações e da checagem de duplicidade, preservando estado nos erros.
- Listar e consultar geram DTOs de leitura (`numero`, `saldo`) a partir das instâncias atuais; não expor referências a `Conta` na resposta HTTP.
- A origem da validação de valores monetários é `Conta`. Se a versão do aluno lança erros genéricos sem código estável, não interpretar `Error.message` por substring: apresentar ao professor a menor proposta para classificar `SALDO_INVALIDO`, preservando testes da Aula 01.
- Um erro desconhecido resulta em `500 ERRO_INTERNO` em vez de ser convertido automaticamente em `400`.

### Composição no Next.js e versão dos parâmetros

Em `src/app/api/contas/route.ts`, exportar **GET e POST** delegando às duas factories. Em `src/app/api/contas/[id]/route.ts`, exportar **GET** delegando à factory e passando o `id` da rota.

No Next.js atual, os parâmetros das rotas dinâmicas podem ser obtidos assíncronamente, como no contrato de referência:

```ts
// Apenas a assinatura ilustrativa; NÃO é implementação do handler.
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response>;
```

Use `await context.params` na composição da rota. Em testes Jest, passe o ID como **string diretamente** à factory, sem depender de `RouteContext` gerado pelo Next.

Respostas GET devem apresentar o estado atual do cadastro (não guardar snapshots ou cache estático). Configure dinamismo do Route Handler e/ou cabeçalhos apropriados para evitar respostas obsoletas durante o laboratório. Não adicionar cache externo.

### Estado compartilhado com a API de transferências

**Obrigatório:** as rotas de contas e de transferências recebem a **mesma instância** de `Map<string, Conta>` no ambiente demonstrativo. Centralize sua criação em um pequeno módulo compartilhado de composição (por exemplo `src/application/estado-contas.ts`) e injete essa instância tanto em `criarOperacoesContas` quanto em `criarOperacaoTransferencia`.

- Cadastro demonstrativo inicial: **vazio**. Para testar uma transferência manual, crie antes as duas contas com `POST /api/contas`.
- Testes devem criar um **Map vazio novo em cada teste** e nunca importar o singleton da aplicação Next.js. Um teste de integração pode montar **ambas as APIs com o mesmo Map local**.
- Esse compartilhamento vale apenas **para o mesmo processo**: hot reload, reinicialização, múltiplos workers e ambiente serverless podem perder/divergir o estado. Não afirmar persistência real, consistência entre processos ou isolamento concorrente.
- A camada de contas não implementa `sacar`, `depositar` nem `transferir`: essas regras continuam em `Conta` e `TransferenciaValor`.

## 5. Matriz de aceite — criação

Fixture padrão dos testes: `Map` vazio, classes bancárias reais e mocks de operação quando o teste for exclusivamente HTTP.

| ID | Ação / entrada | Resultado verificável |
| --- | --- | --- |
| CONTA-01 | Criar `123456` com 1000 | 201; JSON `{numero:'123456',saldo:1000}`; Location correta; uma conta cadastrada |
| CONTA-02 | Criar `001234` com saldo zero | 201; preservar zeros; saldo 0 |
| CONTA-03 | Criar `654321` com 200.29 | 201; saldo 200.29 sem truncar |
| CONTA-04 | Repetir criação de `123456` | 409 `CONTA_JA_EXISTE`; nenhuma substituição; saldo/quantidade intactos |
| CONTA-05 | Número `12345`, `1234567`, `12A456`, numérico, espaços ou ausente | 400 `CONTA_INVALIDA`; não executar criação para formato inválido |
| CONTA-06 | Saldo ausente, string, `null`, -1, 1.255 | 400 `SALDO_INVALIDO`; nenhuma inserção |
| CONTA-07 | Corpo `{`, `null`, `[]` | 400 `REQUISICAO_INVALIDA`; cadastro intacto |
| CONTA-08 | Número inválido **e** saldo inválido; ou número duplicado **e** saldo inválido | Prioridade `CONTA_INVALIDA` / `SALDO_INVALIDO`; nenhum efeito |
| CONTA-09 | Operação simulada lança erro técnico | 500 `ERRO_INTERNO`; resposta sem detalhes técnicos |

## 6. Matriz de aceite — listagem e consulta

| ID | Ação / estado | Resultado verificável |
| --- | --- | --- |
| CONTA-10 | GET lista com cadastro vazio | 200, JSON exato `{"contas":[]}` |
| CONTA-11 | Criar `654321`, `001234`, `123456`; listar | 200; exatamente 3 itens, ordenados `001234`, `123456`, `654321`; saldos corretos |
| CONTA-12 | GET por `123456` existente | 200; JSON exato `{numero:'123456',saldo:1000}` |
| CONTA-13 | GET por `001234` existente | 200; zeros à esquerda preservados |
| CONTA-14 | GET por `999999` inexistente | 404 `CONTA_NAO_ENCONTRADA` |
| CONTA-15 | GET por `12345`, `1234567`, `ABC123` | 400 `CONTA_INVALIDA` |
| CONTA-16 | Repetir listagem e consulta | Sem alterar cadastro, saldos ou ordem do estado |
| CONTA-17 | Atualizar saldo por transferência real e consultar/listar novamente | GETs devolvem **novo saldo**; nenhuma cópia obsoleta |

## 7. Matriz de aceite — integração entre APIs

| ID | Sequência usando **o mesmo Map injetado** | Asserções obrigatórias |
| --- | --- | --- |
| FLUXO-01 | Criar 123456/1000 e 654321/200 → listar → consultar ambos → transferir 300 → consultar/listar | 201/201/200/200/201; comprovante; saldos finais **700 e 500** vistos por GET |
| FLUXO-02 | Criar contas → transferir 1001 → consultar/listar | `422 SALDO_INSUFICIENTE`; saldos **1000 e 200** preservados |
| FLUXO-03 | Criar 001234/0 e outra conta; consultar 001234 | zeros à esquerda e saldo zero sem coerção |
| FLUXO-04 | Iniciar novo Map em outro teste | Lista vazia; nenhuma conta herdada do teste anterior |

Os testes `FLUXO-*` devem **usar `Conta` e `TransferenciaValor` reais**, sem mockar `transferir`. Chamar as factories em processo demonstra a integração entre camadas, **não** uma chamada HTTP de rede ou E2E no navegador.

## 8. Testabilidade e ordem de realização

1. Primeiro RED/GREEN: `CONTA-01` com **mock** de `OperacoesContas.criar` para verificar o contrato POST; não usar domínio neste teste.
2. Evoluir erros estruturais e campos inválidos com mocks (`CONTA-05`, `CONTA-07`, `CONTA-09`).
3. Criar adaptador real com `Map` isolado e cobrir `CONTA-02..04`, `CONTA-06`, `CONTA-08`.
4. Escrever RED/GREEN para GET lista e GET por ID (`CONTA-10..16`).
5. Somente depois integrar ao Route Handler real e, na etapa de transferência, executar `CONTA-17`, `FLUXO-01..04`.

Arquivos de testes recomendados, criados gradualmente:

```text
tests/api/contas.mock.test.ts
tests/api/contas.integracao.test.ts
tests/api/fluxo-bancario.integracao.test.ts  # após concluir transferência
```

Não escrever testes vazios ou alterar asserts para fazê-los passar. A evidência deve registrar o RED real, GREEN, asserções e comandos executados.

## 9. Limites e definição de pronto

Fora do escopo: alteração ou exclusão de contas, saque/depósito via HTTP, autenticação, persistência em disco/banco, concorrência, idempotency keys, paginação, UI, Docker da aplicação e validações bancárias não descritas na Aula 01.

A etapa de contas fica concluída com `CONTA-01..16` cobertos, respostas conforme contrato, adaptador usando `Conta` real, estado isolado nos testes, regressão da Aula 01 passando e `npm test`, `npm run typecheck` e `npm run build` executados com resultados reais. `CONTA-17` e `FLUXO-01..04` **ficam pendentes até a etapa de transferência**, não devendo ser considerados faltas prematuras na etapa 02.
