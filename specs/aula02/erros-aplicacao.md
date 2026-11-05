# SPEC-ERR-001 — Classificação explícita de erros

Versão 2.0 — adaptação técnica da Aula 02, anterior aos handlers HTTP.

## Decisão desta revisão

O domínio da referência lança Error genérico. Para mapear erros sem comparar texto e sem duplicar operações bancárias, adicionar `ErroNegocio` como subclasse de Error, com propriedade pública readonly `codigo`.

Essa extensão é uma atividade autorizada pelo material revisado. Não modifica critérios bancários, nomes de métodos, construtores existentes, cálculos ou mensagens. Os testes antigos continuam válidos e novos testes verificam a classificação.

Contrato a implementar em `src/domain/ErroNegocio.ts`:

```ts
export type CodigoErroNegocio =
  | 'CONTA_INVALIDA'
  | 'SALDO_INVALIDO'
  | 'VALOR_INVALIDO'
  | 'SALDO_INSUFICIENTE'
  | 'MESMA_CONTA'
  | 'CONTA_NAO_ENCONTRADA'
  | 'CONTA_JA_EXISTE';

// Contrato descritivo: implemente a classe com essa assinatura.
// class ErroNegocio extends Error
//   readonly codigo: CodigoErroNegocio
//   constructor(codigo: CodigoErroNegocio, mensagem: string)
```

## Pontos de lançamento

| Origem | Condição já existente | Código a acrescentar |
| --- | --- | --- |
| `NumeroConta` | Número inválido | CONTA_INVALIDA |
| Construtor de `Conta` | Saldo inicial inválido | SALDO_INVALIDO |
| Validação de saque/depósito em `Conta` | Valor inválido | VALOR_INVALIDO |
| `Conta.sacar` | Saldo insuficiente | SALDO_INSUFICIENTE |
| `TransferenciaValor.transferir` | Mesma conta | MESMA_CONTA |
| Adaptador de contas | Duplicidade no cadastro | CONTA_JA_EXISTE |
| Adaptador de transferência | Conta não cadastrada | CONTA_NAO_ENCONTRADA |

Preserve literalmente as mensagens já lançadas pelo domínio nos pontos existentes. Os dois erros novos dos adaptadores podem ter mensagens descritivas, sem que elas sejam expostas na resposta HTTP.

O excesso de saldo máximo no depósito e o recibo inválido continuam falhas não mapeadas por este contrato HTTP e produzem `500 ERRO_INTERNO`, com estado preservado. Não classificar qualquer Error genérico como erro de entrada nem inventar código HTTP para essas falhas.

**Regra de reutilização.** O domínio é a única fonte das validações da tabela acima. Os handlers não as repetem: apenas capturam `ErroNegocio`. Se a ordem de precedência exigir checar algo antes de construir o objeto, o adaptador de aplicação usa as classes reais (`new NumeroConta(...)`). Só se isso for impossível, exportar a checagem do domínio (por exemplo `NumeroConta.ehValido`) sem mudar mensagens, e importá-la, nunca copiá-la. Registrar a decisão.

Erros estruturais de JSON e tipos podem ser respondidos diretamente pelo handler. Não é preciso lançar ErroNegocio para cada requisição rejeitada antes da operação.

## Testes e regressão

| ID | Ação | Asserções |
| --- | --- | --- |
| ERR-01 | Lançar/instanciar ErroNegocio | É Error; código correto; mensagem preservada |
| ERR-02 | Sacar acima do saldo | ErroNegocio com SALDO_INSUFICIENTE, mensagem antiga e saldo inalterado |
| ERR-03 | Invocar cada validação do domínio da tabela | Código correto e nenhum efeito indevido |
| ERR-04 | Executar a regressão antiga | Todos os testes anteriores continuam aprovados, sem mudar asserções |

Trabalhe por TDD, um lançamento por vez. Não escrever inicialmente todos os novos testes como se as exceções já existissem. Os testes dos erros de adaptadores pertencem às etapas desses adaptadores.

Os handlers reconhecem `instanceof ErroNegocio` e uma lista explícita de códigos válidos para aquele endpoint. Erro desconhecido, inclusive um código não previsto para a operação, resulta em 500 e corpo genérico. Nunca usar `message.includes`, regex de mensagem ou comparação de texto para decidir o HTTP.

Concluir com Jest e tipos aprovados. Registre a adaptação antes de avançar para os contratos HTTP; não alterar a BANK-SPEC-001 para acomodar uma implementação.
