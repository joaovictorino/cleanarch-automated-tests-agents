# language: pt
@api @bdd
Funcionalidade: Transferências bancárias pela API
  Como cliente de uma instituição financeira
  Quero solicitar transferências entre contas por uma API
  Para movimentar valores e receber um comprovante de seis dígitos

  @bdd-01 @api-01 @sucesso
  Cenário: Transferir 300 entre duas contas com saldo suficiente
    Dado que existe a conta "123456" com saldo 1000
    E que existe a conta "654321" com saldo 200
    Quando solicito uma transferência de 300 da conta "123456" para a conta "654321"
    Então o status HTTP deve ser 201
    E o saldo da conta "123456" deve ser 700
    E o saldo da conta "654321" deve ser 500
    E a resposta deve conter um comprovante de seis dígitos

  @bdd-02 @api-02 @limite
  Cenário: Transferir exatamente o saldo disponível
    Dado que existe a conta "123456" com saldo 1000
    E que existe a conta "654321" com saldo 200
    Quando solicito uma transferência de 1000 da conta "123456" para a conta "654321"
    Então o status HTTP deve ser 201
    E o saldo da conta "123456" deve ser 0
    E o saldo da conta "654321" deve ser 1200
    E a resposta deve conter um comprovante de seis dígitos

  @bdd-03 @api-03 @erro-negocio
  Cenário: Rejeitar transferência acima do saldo disponível
    Dado que existe a conta "123456" com saldo 1000
    E que existe a conta "654321" com saldo 200
    Quando solicito uma transferência de 1001 da conta "123456" para a conta "654321"
    Então o status HTTP deve ser 422
    E o erro retornado deve ser "SALDO_INSUFICIENTE"
    E o saldo da conta "123456" deve ser 1000
    E o saldo da conta "654321" deve ser 200

  @bdd-04 @validacao
  Cenário: Rejeitar transferência com valor zero
    Dado que existe a conta "123456" com saldo 1000
    E que existe a conta "654321" com saldo 200
    Quando solicito uma transferência de 0 da conta "123456" para a conta "654321"
    Então o status HTTP deve ser 400
    E o erro retornado deve ser "VALOR_INVALIDO"
    E o saldo da conta "123456" deve ser 1000
    E o saldo da conta "654321" deve ser 200

  @bdd-05 @validacao
  Cenário: Rejeitar transferência com valor negativo
    Dado que existe a conta "123456" com saldo 1000
    E que existe a conta "654321" com saldo 200
    Quando solicito uma transferência de -10 da conta "123456" para a conta "654321"
    Então o status HTTP deve ser 400
    E o erro retornado deve ser "VALOR_INVALIDO"
    E o saldo da conta "123456" deve ser 1000
    E o saldo da conta "654321" deve ser 200

  @bdd-06 @json-invalido
  Cenário: Rejeitar corpo JSON malformado sem modificar as contas
    Dado que existe a conta "123456" com saldo 1000
    E que existe a conta "654321" com saldo 200
    Quando envio o seguinte corpo bruto para a API de transferências:
      """
      {"contaOrigem":"123456",
      """
    Então o status HTTP deve ser 400
    E o saldo da conta "123456" deve ser 1000
    E o saldo da conta "654321" deve ser 200
