# Especificação — Operações Bancárias e Transferência

**Identificador:** BANK-SPEC-001  
**Versão:** 1.0  
**Escopo:** Domínio bancário em memória  
**Tecnologias:** TypeScript e Jest

## 1. Objetivo

Implementar e testar operações bancárias básicas, permitindo a transferência de valores entre contas com respeito às regras de saldo, valor e identificação das contas.

Esta especificação será utilizada como referência para desenvolvimento por agentes de codificação.

## 2. Estória de usuário

**Como** cliente,  
**quero** transferir dinheiro da minha conta para a conta de outro cliente,  
**para** realizar uma movimentação financeira e obter um comprovante.

## 3. Critérios de aceite

### AC01 — Conta de destino válida

O cliente deve informar uma conta de destino válida.

O identificador da conta deve possuir exatamente seis dígitos numéricos.

### AC02 — Valor válido

O valor da transferência deve ser maior que zero.

### AC03 — Saldo suficiente

A transferência somente será permitida quando:

`saldoOrigem >= valorTransferencia`

### AC04 — Transferência aceita

Uma transferência válida deve:

- Debitar o valor da conta de origem.
- Creditar o mesmo valor na conta de destino.
- Retornar um número de comprovante.

### AC05 — Transferência rejeitada

Uma transferência rejeitada não deve alterar o saldo da conta de origem nem o saldo da conta de destino.

## 4. Decisões técnicas do laboratório

As decisões abaixo complementam os critérios originais para estabelecer contratos testáveis.

### DT01 — Representação monetária

Os valores financeiros são representados em reais, como números finitos com no máximo duas casas decimais.

Exemplo:

| Valor em reais | Número utilizado |
|---|---:|
| R$ 1,50 | 1.5 |
| R$ 20,00 | 20 |
| R$ 30,00 | 30 |
| R$ 70,00 | 70 |
| R$ 100,00 | 100 |

Valores com mais de duas casas decimais (por exemplo, 1.255) são inválidos.

Os cálculos devem ser arredondados para duas casas decimais, de modo que, por exemplo, depositar 0.1 e 0.2 resulte em saldo 0.3.

### DT02 — Saldo inicial

Uma conta não deve ser criada com saldo negativo, com mais de duas casas decimais ou não finito.

Saldo inicial fracionário com até duas casas decimais (por exemplo, 1.5) é permitido.

Saldo inicial igual a zero é permitido.

### DT03 — Conta de origem e destino

A conta de origem e a conta de destino devem ter identificadores diferentes.

### DT04 — Comprovante

O comprovante terá um código representado por uma string numérica de seis dígitos.

O código deverá poder ser fornecido por um gerador controlável durante os testes.

A verificação de unicidade global do comprovante não faz parte deste laboratório.

### DT05 — Operação em memória

As alterações de saldo serão realizadas em objetos em memória.

Não haverá persistência, transações de banco de dados ou comunicação entre serviços.

A preservação dos saldos em rejeições deverá ser testada, mas a atomicidade transacional de um sistema distribuído não está contemplada.

### DT06 — Validação monetária

A validação dos valores monetários é responsabilidade de `Conta` e deve ser implementada dentro da própria classe, sem funções utilitárias soltas, tipos ou arquivos adicionais:

- Saldo inicial: número finito, com até duas casas decimais, maior ou igual a zero.
- Saque e depósito: número finito, com até duas casas decimais, maior que zero.
- Depósito que faria o saldo ultrapassar `Number.MAX_SAFE_INTEGER` deve ser rejeitado.

`TransferenciaValor` não duplica essas regras; delega-as a `sacar` e `depositar` e deve preservar os saldos quando uma delas falhar.

### DT07 — Geração do comprovante

`Recibo` é responsável por validar o formato do código e por fornecer o gerador padrão (`Recibo.gerarCodigoAleatorio`), que produz seis dígitos pseudoaleatórios, com zeros à esquerda.

`TransferenciaValor` recebe o gerador por parâmetro e utiliza o de `Recibo` quando nenhum é informado. Um código inválido produzido pelo gerador deve rejeitar a transferência antes de qualquer alteração de saldo.

## 5. Contratos de código

### NumeroConta

Construtor:

`new NumeroConta(numero: string)`

Propriedade pública:

`numero: string`

Deve validar exatamente seis dígitos ASCII (`0` a `9`).

### Conta

Construtor:

`new Conta(numero: string, saldoInicial: number)`

Propriedades públicas de leitura:

- `numero: string`
- `saldo: number`

Métodos:

- `sacar(valor: number): void`
- `depositar(valor: number): void`

Em caso de violação das regras de negócio, a operação deverá lançar uma exceção sem alterar indevidamente o saldo.

A validação dos valores monetários é feita pela própria `Conta` (ver DT06).

### Recibo

Propriedade pública:

`codigo: string`

Representa o comprovante de uma operação aceita.

Construtor:

`new Recibo(codigo: string)`

Deve validar que o código possui exatamente seis dígitos ASCII (`0` a `9`).

Método estático:

`Recibo.gerarCodigoAleatorio(): string`

Gerador padrão de códigos (ver DT07).

### TransferenciaValor

Construtor:

`new TransferenciaValor(gerarCodigo?: () => string)`

Método:

`transferir(origem: Conta, destino: Conta, valor: number): Recibo`

O gerador de comprovantes poderá ser substituído nos testes.

## 6. Matriz de cenários de teste

| ID | Cenário | Resultado esperado |
|---|---|---|
| CT01 | Conta com seis dígitos | Aceitar |
| CT02 | Conta com cinco dígitos | Rejeitar |
| CT03 | Conta com sete dígitos | Rejeitar |
| CT04 | Conta contendo letras | Rejeitar |
| CT05 | Conta com zeros à esquerda | Aceitar e preservar |
| CT06 | Saque menor que saldo | Debitar |
| CT07 | Saque igual ao saldo | Saldo zero |
| CT08 | Saque maior que saldo | Rejeitar, sem alterar saldo |
| CT09 | Saque zero ou negativo | Rejeitar |
| CT10 | Depósito positivo | Creditar |
| CT11 | Depósito zero ou negativo | Rejeitar |
| CT19 | Saque ou depósito fracionário com até duas casas decimais (ex.: 1.5) | Aceitar |
| CT12 | Transferência com saldo suficiente | Debitar e creditar |
| CT13 | Transferência com saldo exato | Aceitar |
| CT14 | Transferência com saldo insuficiente | Rejeitar sem alterar saldos |
| CT15 | Transferência de valor inválido | Rejeitar |
| CT16 | Transferência para a própria conta | Rejeitar |
| CT17 | Transferência válida | Retornar comprovante |
| CT18 | Entrada monetária não finita ou com mais de duas casas decimais | Rejeitar |

CT01 a CT17 detalham ou complementam os fluxos do exercício bancário. CT18 e CT19 decorrem da decisão de representar dinheiro em reais com até duas casas decimais.

## 7. Exemplos de comportamento

### Cenário 01 — Transferência aceita

**Dado que:**

- A conta 123456 possui R$ 100,00.
- A conta 654321 possui R$ 20,00.

**Quando:**

- O cliente transfere R$ 30,00 da conta 123456 para a conta 654321.

**Então:**

- A conta 123456 deverá ter R$ 70,00.
- A conta 654321 deverá ter R$ 50,00.
- Um comprovante deverá ser retornado.

### Cenário 02 — Saldo insuficiente

**Dado que:**

- A conta 123456 possui R$ 20,00.
- A conta 654321 possui R$ 50,00.

**Quando:**

- O cliente tenta transferir R$ 30,00.

**Então:**

- A transferência deverá ser rejeitada.
- O saldo da origem continuará R$ 20,00.
- O saldo do destino continuará R$ 50,00.
- Nenhum comprovante de sucesso deverá ser retornado.

### Cenário 03 — Valor igual a zero

**Dado que:**

- A conta de origem possui saldo disponível.
- A conta de destino é válida.

**Quando:**

- O cliente tenta transferir R$ 0,00.

**Então:**

- A operação deverá ser rejeitada.
- Nenhum saldo deverá ser alterado.

### Cenário 04 — Saldo exatamente suficiente

**Dado que:**

- A conta 123456 possui R$ 30,00.
- A conta 654321 possui R$ 10,00.

**Quando:**

- O cliente transfere R$ 30,00.

**Então:**

- O saldo da origem será R$ 0,00.
- O saldo do destino será R$ 40,00.
- A transferência será aceita.
- Um comprovante será retornado.

### Cenário 05 — Identificador inválido

**Dado que:**

- O cliente informou uma conta com cinco dígitos.

**Quando:**

- O sistema valida o número da conta.

**Então:**

- O identificador deverá ser rejeitado.
- Nenhuma transferência deverá ser iniciada.

### Cenário 06 — Transferência para a mesma conta

**Dado que:**

- A conta de origem e a conta de destino possuem o mesmo número.

**Quando:**

- O cliente solicita uma transferência.

**Então:**

- A operação será rejeitada.
- Nenhum saldo será alterado.

## 8. Requisitos de qualidade dos testes

A suíte deve verificar:

- O comportamento esperado em casos válidos.
- Os erros esperados em casos inválidos.
- Os limites das entradas.
- O saldo antes e depois das operações.
- Os dois saldos nas transferências.
- O comprovante retornado.
- A independência entre os testes.

Não são suficientes testes que verificam exclusivamente:

- Se uma função foi chamada.
- Se uma variável existe.
- Se o retorno não é nulo.
- Se foi retornado um valor booleano de sucesso.

Os efeitos financeiros precisam ser observados.

## 9. Critérios de conclusão

A implementação estará aderente quando:

1. Todos os critérios de aceite estiverem satisfeitos.
2. Os testes correspondentes estiverem automatizados.
3. As operações rejeitadas preservarem o estado das contas.
4. Jest executar com sucesso.
5. O TypeScript não apresentar erros de tipagem.
6. O código puder ser testado sem banco de dados ou API.
7. As decisões não especificadas tiverem sido identificadas e justificadas.

## 10. Fora do escopo

- Persistência em banco.
- Controle de concorrência.
- Transações distribuídas.
- Autenticação e autorização.
- Auditoria financeira real.
- Garantia global de unicidade do comprovante.
- APIs HTTP.
- Interface de usuário.
- Transferências reais entre instituições financeiras.

Esses assuntos podem ser introduzidos progressivamente nas próximas aulas.
