# SPEC-TEST-002 — Estratégia de testes da API de contas

**Versão:** 1.0  
**Etapas:** 02 (contas) e integração final de APIs  
**Dependências:** `specs/api-contas.md` e `specs/transferencia.md`.

## 1. Propósito didático

Distinguir: **mock** de contrato HTTP, **integração** de operações de contas com a classe `Conta` real e **fluxo cruzado** entre API de contas e API de transferências. Não iniciar Next.js nos testes Jest: chamar as factories com `Request` da Web API. Não utilizar banco de dados, rede, E2E ou `jest.mock()` para `Conta` nos testes integrados.

| Categoria | Recurso | O que verificar |
| --- | --- | --- |
| Mock | `jest.fn()` para `OperacoesContas.criar/listar/consultar` | Corpo/status HTTP; parâmetros da delegação; ausência de chamada em requisição malformada |
| Fake | `new Map<string, Conta>()` por teste | Cadastro previsível e isolamento de estado |
| Integração real | Adaptador + `new Conta(...)` | Inserção única, saldo validado, listagem/consulta atualizadas, imutabilidade de consultas |
| Fluxo entre APIs | Mesma instância local de `Map` para contas e transferência | Criar → listar/consultar → transferir → consultar, observando **os dois** saldos |

## 2. Primeiro RED — um teste completo pronto para o aluno

O teste é um **contrato a atender**, não contém implementação do endpoint.

```ts
// tests/api/contas.mock.test.ts
import { criarPostContas } from '../../src/api/contas/handlers';

describe('POST /api/contas — contrato HTTP com mock', () => {
  test('CMOCK-01: criar conta devolve 201 e Location', async () => {
    // Arrange
    const criar = jest.fn().mockResolvedValue({ numero: '123456', saldo: 1000 });
    const operacoes = {
      criar,
      listar: jest.fn(),
      consultar: jest.fn(),
    };
    const POST = criarPostContas(operacoes);
    const request = new Request('http://localhost/api/contas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numero: '123456', saldoInicial: 1000 }),
    });

    // Act
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ numero: '123456', saldo: 1000 });
    expect(response.headers.get('Location')).toBe('/api/contas/123456');
    expect(criar).toHaveBeenCalledTimes(1);
    expect(criar).toHaveBeenCalledWith({ numero: '123456', saldoInicial: 1000 });
  });
});
```

**RED esperado:** o arquivo/exports `criarPostContas` ainda não existe. **GREEN:** criar somente a factory e a assinatura `OperacoesContas`, sem implementar regras monetárias. Execute `npm test -- --runInBand` após cada novo comportamento.

## 3. Matriz dos mocks

| ID | Operação | Asserções mínimas |
| --- | --- | --- |
| CMOCK-01 | POST válido / `criar` resolve DTO | 201, corpo, Location, chamada única com argumentos corretos |
| CMOCK-02 | POST número inválido / saldo com tipo string | 400 `CONTA_INVALIDA` ou `SALDO_INVALIDO`; `criar` **não** chamado |
| CMOCK-03 | POST JSON quebrado / `null` / array | 400 `REQUISICAO_INVALIDA`; `criar` não chamado |
| CMOCK-04 | POST `criar` rejeita com erro identificado `CONTA_JA_EXISTE` | 409; não vazar mensagem interna |
| CMOCK-05 | `criar` lança erro inesperado | 500 `ERRO_INTERNO`; resposta não revela segredo |
| CMOCK-06 | GET lista / `listar` resolve DTOs fora de ordem | 200; handler entrega ordenação contratada; somente `listar` chamado |
| CMOCK-07 | GET por ID válido / `consultar` retorna DTO | 200; `consultar('123456')` chamado uma vez |
| CMOCK-08 | GET por ID inválido | 400; `consultar` não chamado |
| CMOCK-09 | GET por ID inexistente / `consultar` retorna `undefined` | 404; corpo exato |

**Distinção essencial:** `CMOCK-01` não demonstra que uma conta foi criada em memória, apenas que o contrato HTTP chamou a operação simulada. O erro `SALDO_INVALIDO` para saldo numérico negativo/fracionário é verificado **com a classe real `Conta`**, não com uma implementação monetária copiada para o handler.

### Exemplos adicionais prontos para RED: listagem e consulta

Após o professor liberar os GETs, inclua os testes abaixo no mesmo arquivo `tests/api/contas.mock.test.ts`. Cada teste é independente e **não implementa o comportamento**.

```ts
import { criarGetContas, criarGetContaPorId } from '../../src/api/contas/handlers';

test('CMOCK-06: lista DTOs ordenados pelo número da conta', async () => {
  const listar = jest.fn().mockResolvedValue([
    { numero: '654321', saldo: 200 },
    { numero: '001234', saldo: 0 },
  ]);
  const operacoes = { criar: jest.fn(), listar, consultar: jest.fn() };
  const GET = criarGetContas(operacoes);

  const response = await GET(new Request('http://localhost/api/contas'));

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    contas: [
      { numero: '001234', saldo: 0 },
      { numero: '654321', saldo: 200 },
    ],
  });
  expect(listar).toHaveBeenCalledTimes(1);
});

test('CMOCK-07: consulta ID válido e retorna uma conta', async () => {
  const consultar = jest.fn().mockResolvedValue({ numero: '123456', saldo: 1000 });
  const operacoes = { criar: jest.fn(), listar: jest.fn(), consultar };
  const GET = criarGetContaPorId(operacoes);

  const response = await GET(
    new Request('http://localhost/api/contas/123456'), '123456',
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ numero: '123456', saldo: 1000 });
  expect(consultar).toHaveBeenCalledTimes(1);
  expect(consultar).toHaveBeenCalledWith('123456');
});
```

Esses exemplos devem ser introduzidos **somente quando a etapa GET for liberada**, para manter o caráter incremental da aula. O teste CMOCK-06 garante a ordenação na resposta HTTP, sem depender de como o adaptador real itera seu Map.

## 4. Matriz dos testes com domínio e cadastro reais

Em **cada teste**, crie `new Map<string, Conta>()` e `criarOperacoesContas(map)`; não importe o cadastro global do `route.ts`. O aluno deve usar os construtores reais da Aula 01.

| ID | Preparação / ação | Asserções mínimas |
| --- | --- | --- |
| CINT-01 | Criar `123456`, saldo 1000 | 201, Location, `map.size === 1`, `map.get('123456')` é `Conta` real, saldo 1000 |
| CINT-02 | Criar `001234`/0 e `654321`/200.29 | Status 201, zeros preservados, saldos exatos |
| CINT-03 | Criar 123456 duas vezes | 409, `map.size` intacto, mesma instância de conta, saldo original |
| CINT-04 | Criar com saldo -1, 1.255, número malformado | 400 adequado, `map.size === 0` |
| CINT-05 | GET vazio | 200 `{"contas":[]}` |
| CINT-06 | Criar 654321, 001234, 123456 e listar | 200, 3 registros ordenados, campos exatos e saldos corretos |
| CINT-07 | Consultar 123456 e 001234 | 200, sem perda de zeros, nenhuma alteração de saldo |
| CINT-08 | Consultar 999999 ou ID malformado | 404 ou 400, sem alterar Map |
| CINT-09 | Novo Map em outro teste | GET lista vazia, sem influência de outros testes |
| CINT-10 | Criar, listar e consultar repetidas vezes | Nenhuma operação de leitura altera valores ou objetos |

**Exemplo de esqueleto que precisa ser completado (não é teste válido isoladamente):**

```ts
test('CINT-03: conta duplicada não substitui saldo', async () => {
  // Arrange: Conta real, Map novo e adaptador real.
  // Act: criar 123456 com 1000 e repetir com 200 via POST.
  // Assert: 409, erro CONTA_JA_EXISTE, Map com uma entrada,
  // mesma referência original e saldo igual a 1000.
});
```

Não declarar testes aprovados por copiar o esqueleto. Cada teste deve ter asserts e execução Jest.

## 5. Fluxo cruzado: integração entre criação, consulta e transferência

Após o professor liberar a etapa de transferência, adicionar `tests/api/fluxo-bancario.integracao.test.ts` com as factories reais de contas e transferência, **injetando o mesmo Map novo no teste** e gerador determinístico `() => '123456'`.

| ID | Passos | Provas obrigatórias |
| --- | --- | --- |
| FLUXO-01 | POST conta 123456/1000; POST conta 654321/200; GET lista; GET cada ID; POST transferência de 300; GET cada ID; GET lista | Cada status/corpo, comprovante 123456, saldos 700/500 em leitura HTTP e objetos reais |
| FLUXO-02 | Criar duas contas; tentar transferir 1001; consultar | 422, erro de saldo, nenhum saldo alterado |
| FLUXO-03 | Criar `001234`/0 e consultar | ID textual intacto e saldo zero |
| FLUXO-04 | Repetir fluxo com outro Map | Nenhuma transferência, conta ou saldo herdados |

**Não é correto:** mockar `TransferenciaValor.transferir`, manter Map global em testes ou verificar apenas `expect(response.status).toBe(201)` sem ler os saldos. Falhas não podem gerar comprovante de sucesso.

## 6. Evidências e ponto de parada

Registre IDs `CONTA-*`, `CMOCK-*`, `CINT-*`, `BDD-C*` e `FLUXO-*` na matriz `specs/rastreabilidade.md`, com nomes **reais** dos testes, saídas Jest e eventuais decisões sobre mapeamento de erros. As evidências devem separar:

- RED por contrato ainda não implementado;
- GREEN após menor implementação;
- refatoração sem mudanças de comportamento;
- testes de mock e testes de integração real;
- testes de fluxo pendentes até autorização da etapa de transferências.

Pare após a API de contas, mesmo que haja novos fluxos previstos na spec. Não avançar automaticamente para transferências ou frontend.
