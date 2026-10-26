# SPEC-TEST-001 — Test doubles, integração e independência

**Versão:** 1.0  
**Etapas:** 02 e 03 — TDD da API e comparação de testes  
**Dependências:** `specs/api-transferencias.md`, `specs/transferencia.md`.

## 1. Finalidade

Demonstrar empiricamente a diferença entre **mock de contrato** e **integração do domínio real**. Nenhum teste deve depender de porta HTTP, aplicação Next rodando, banco de dados, relógio ou ordem de execução.

| Recurso | Implementação na aula | Prova que fornece | O que não prova |
| --- | --- | --- | --- |
| **Mock** | `jest.fn()` como `operacao.executar` | Chamada, argumentos, status e corpo HTTP | Débito e crédito reais |
| **Stub** | `() => '123456'` | Saída determinística do comprovante | Unicidade global |
| **Fake** | `new Map<string, Conta>()` por teste | Busca local previsível de contas | Persistência, concorrência, transação distribuída |
| **Integração em processo** | Handler + adaptador + classes bancárias reais | Contrato HTTP **e ambos os saldos** | Rede HTTP real e fluxo no navegador |

## 2. Contrato da factory para testes

A factory deve ser exportada de `src/api/transferencias/handler.ts`:

```ts
import { criarPostTransferencias } from '../../src/api/transferencias/handler';
```

**Exemplo executável de teste RED (sem solução de implementação):**

```ts
// tests/api/transferencias.mock.test.ts
import { criarPostTransferencias } from '../../src/api/transferencias/handler';

describe('POST /api/transferencias — mock da operação', () => {
  test('MOCK-01: encaminha dados e devolve comprovante HTTP 201', async () => {
    // Arrange
    const executar = jest.fn().mockResolvedValue({ comprovante: '123456' });
    const POST = criarPostTransferencias({ executar });
    const requisicao = new Request('http://localhost/api/transferencias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contaOrigem: '123456', contaDestino: '654321', valor: 300,
      }),
    });

    // Act
    const resposta = await POST(requisicao);

    // Assert
    expect(resposta.status).toBe(201);
    expect(await resposta.json()).toEqual({ comprovante: '123456' });
    expect(executar).toHaveBeenCalledTimes(1);
    expect(executar).toHaveBeenCalledWith({
      contaOrigem: '123456', contaDestino: '654321', valor: 300,
    });
  });
});
```

**RED esperado:** erro de importação porque a factory ainda não existe. **GREEN:** criar o mínimo da factory, sem classes bancárias novas.

## 3. Matriz dos testes obrigatórios com mock

| ID | Entrada / simulação | Asserções mínimas |
| --- | --- | --- |
| MOCK-01 | JSON válido; `executar` retorna comprovante | 201, corpo exato, chamada uma vez com argumentos corretos |
| MOCK-02 | `valor = 0` | 400 `VALOR_INVALIDO`; `executar` não chamado |
| MOCK-03 | Conta com cinco dígitos; corpo JSON inválido | 400 com código específico; `executar` não chamado |
| MOCK-04 | `executar` rejeita com erro de domínio identificado como `SALDO_INSUFICIENTE` | 422 `SALDO_INSUFICIENTE`; chamada uma vez; sem vazamento de mensagem |
| MOCK-05 | `executar` lança `new Error('segredo interno')` | 500 `ERRO_INTERNO`; resposta não contém `segredo interno` |

**Teste de invalidez pronto para adaptação:**

```ts
test('MOCK-02: valor zero é rejeitado antes do serviço', async () => {
  const executar = jest.fn();
  const POST = criarPostTransferencias({ executar });
  const requisicao = new Request('http://localhost/api/transferencias', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contaOrigem: '123456', contaDestino: '654321', valor: 0,
    }),
  });
  const resposta = await POST(requisicao);
  expect(resposta.status).toBe(400);
  expect(await resposta.json()).toEqual({ erro: 'VALOR_INVALIDO' });
  expect(executar).not.toHaveBeenCalled();
});
```

## 4. Matriz dos testes de integração com domínio real

**Obrigação técnica:** `new Conta(...)`, `new TransferenciaValor(gerador)` e `.transferir(...)` devem ser os reais da Aula 01. Adaptar imports ao diretório efetivo do aluno. Criar um **Map novo por teste** e injetá-lo no adaptador; não importar o Map único usado por `route.ts`.

| ID | Fixture (origem/destino) | Chamada | Asserções obrigatórias |
| --- | --- | --- | --- |
| INT-01 | 1000 / 200 | Transferir 300 | 201, comprovante `123456`, saldos 700 / 500 |
| INT-02 | 1000 / 200 | Transferir 1001 | 422 `SALDO_INSUFICIENTE`, saldos 1000 / 200 |
| INT-03 | 1000 / 200 | Transferir 1000 | 201, origem 0 e destino 1200 |
| INT-04 | 1000 / 200 por teste | Executar INT-01 duas vezes com nova fixture | Ambos os testes iniciam com 1000 / 200, sem vazamento de estado |
| INT-05 | 1000 / 200 | Mesma conta, saldo inválido ou conta ausente (`test.each` onde couber) | Erro contratual; **ambos** os saldos originais |
| INT-06 | 1000 / 200 | Gerador retorna `'ERRADO'` | Erro sem mutação; dois saldos preservados |

O adaptador pode usar a interface:

```ts
export type CadastroContas = Pick<Map<string, Conta>, 'get'>;
// Conta corresponde ao tipo real da Aula 01; esta é uma orientação,
// não exige criar este alias se isso trouxer acoplamento desnecessário.
```

A instância real pode variar entre alunos; o **comportamento observável** não muda. Não exigir que implementações distintas tenham o mesmo construtor de adaptador, desde que a factory `criarPostTransferencias` respeite o contrato especificado.

**Esqueleto para o aluno concluir:**

```ts
// tests/api/transferencias.integracao.test.ts
// Adapte somente os imports e a montagem do adaptador real.
// É proibido mockar TransferenciaValor.transferir aqui.

test('INT-01: debita e credita com domínio real', async () => {
  // Arrange: Conta('123456', 1000), Conta('654321', 200),
  // Map isolado, gerador () => '123456', adaptador real e factory HTTP.
  // Act: POST com valor 300.
  // Assert: status 201, comprovante 123456, saldos 700 e 500.
});
```

Não copie esse esqueleto como teste aprovado: ele não possui asserções e **não** conta como entrega.

## 5. Regras de integridade dos testes

- Nomes de testes devem informar resultado verificável, não apenas a existência de código.
- Use `test.each` para entradas equivalentes sem encobrir diferenças de comportamento.
- Um teste HTTP com mock **não** é contabilizado como prova de efeitos bancários.
- Um teste de integração **não** deve limitar-se a `expect(comprovante).toBeDefined()`.
- Não utilize snapshots, timers, `Math.random()` não controlado, variáveis globais mutáveis ou recursos externos para testar o domínio.
- Para falhas, inspecione antes e depois **as duas instâncias de Conta**; também valide que não existe comprovante de sucesso.
- Apresente falha inicial RED, código mínimo GREEN e alteração REFACTOR apenas se houver ganho legível.

## 6. Ponto de parada

Produzir uma tabela que associe `MOCK-*`, `INT-*` e `API-*` aos títulos reais dos testes, com resultado da execução. Só depois prosseguir a BDD/CI com autorização do professor.
