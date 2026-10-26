# language: pt
@aula02 @contrato-http
Funcionalidade: Transferência bancária por API HTTP
  Como cliente de uma instituição financeira
  Quero solicitar transferências entre duas contas
  Para movimentar valores e receber um comprovante

  Contexto:
    Dado que uma instância isolada do sistema foi preparada
    E que a conta "123456" possui saldo de 1000 reais
    E que a conta "654321" possui saldo de 200 reais
    E que o gerador de comprovante foi fixado em "123456"

  @BDD-01 @API-01 @INT-01
  Cenário: Transferência aceita altera os dois saldos
    Quando solicito transferir 300 reais da conta "123456" para "654321"
    Então o código HTTP deve ser 201
    E o comprovante retornado deve ser "123456"
    E o saldo da conta "123456" deve ser 700 reais
    E o saldo da conta "654321" deve ser 500 reais

  @BDD-02 @API-02 @INT-03
  Cenário: Transferência do saldo integral é aceita
    Quando solicito transferir 1000 reais da conta "123456" para "654321"
    Então o código HTTP deve ser 201
    E o saldo da conta "123456" deve ser 0 reais
    E o saldo da conta "654321" deve ser 1200 reais

  @BDD-03 @API-03 @INT-02
  Cenário: Saldo insuficiente não altera nenhuma conta
    Quando solicito transferir 1001 reais da conta "123456" para "654321"
    Então o código HTTP deve ser 422
    E o código de erro deve ser "SALDO_INSUFICIENTE"
    E o saldo da conta "123456" deve continuar 1000 reais
    E o saldo da conta "654321" deve continuar 200 reais

  @BDD-04 @API-04 @MOCK-02
  Esquema do Cenário: Valor não positivo é rejeitado antes do serviço
    Quando solicito transferir <valor> reais da conta "123456" para "654321"
    Então o código HTTP deve ser 400
    E o código de erro deve ser "VALOR_INVALIDO"
    E a operação bancária não deve ser chamada
    Exemplos:
      | valor |
      | 0     |
      | -1    |

  @BDD-05 @API-06 @MOCK-03
  Cenário: Identificador malformado é rejeitado
    Quando solicito transferir 300 reais da conta "12345" para "654321"
    Então o código HTTP deve ser 400
    E o código de erro deve ser "CONTA_INVALIDA"
    E a operação bancária não deve ser chamada

  @BDD-06 @API-07
  Cenário: Conta válida no formato mas inexistente é rejeitada
    Quando solicito transferir 300 reais da conta "123456" para "999999"
    Então o código HTTP deve ser 404
    E o código de erro deve ser "CONTA_NAO_ENCONTRADA"
    E o saldo da conta "123456" deve continuar 1000 reais
    E o saldo da conta "654321" deve continuar 200 reais

  @BDD-07 @API-08
  Cenário: Transferência para si mesma não é permitida
    Quando solicito transferir 300 reais da conta "123456" para "123456"
    Então o código HTTP deve ser 422
    E o código de erro deve ser "MESMA_CONTA"
    E o saldo da conta "123456" deve continuar 1000 reais

  @BDD-08 @API-09
  Cenário: Corpo JSON inválido é rejeitado
    Quando envio o corpo HTTP malformado "{"
    Então o código HTTP deve ser 400
    E o código de erro deve ser "REQUISICAO_INVALIDA"
    E a operação bancária não deve ser chamada

  @BDD-09 @API-10
  Cenário: Identificadores preservam zeros à esquerda
    Dado que a conta "001234" possui saldo de 1 real
    Quando solicito transferir 0.29 real da conta "001234" para "654321"
    Então o código HTTP deve ser 201
    E o saldo da conta "001234" deve ser 0.71 real
    E o saldo da conta "654321" deve ser 200.29 reais

  @BDD-10 @API-11 @MOCK-05
  Cenário: Erro técnico não revela detalhes internos
    Dado que a operação bancária simulada falhará com uma mensagem interna
    Quando solicito transferir 300 reais da conta "123456" para "654321"
    Então o código HTTP deve ser 500
    E o código de erro deve ser "ERRO_INTERNO"
    E a resposta não deve revelar a mensagem interna

  @BDD-11 @API-13 @INT-06
  Cenário: Comprovante inválido não movimenta valores
    Dado que o gerador de comprovante foi fixado em "ERRADO"
    Quando solicito transferir 300 reais da conta "123456" para "654321"
    Então o código HTTP deve ser 500
    E o código de erro deve ser "ERRO_INTERNO"
    E o saldo da conta "123456" deve continuar 1000 reais
    E o saldo da conta "654321" deve continuar 200 reais
