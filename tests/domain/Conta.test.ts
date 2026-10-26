import { Conta } from "../../src/domain/Conta";

describe("Conta", () => {
  it("sacar com sucesso", () => {
    //Arrange
    const conta: Conta = new Conta("123456", 1000);

    //Act
    conta.sacar(500);

    //Assert
    expect(conta.saldo).toBe(500);
  });

  it("não deve permitir saque maior que o saldo", () => {
    //Arrange
    const conta: Conta = new Conta("123456", 1000);

    //Act & Assert
    expect(() => conta.sacar(1500)).toThrow("Saldo insuficiente");
  });

  it("deve zerar o saldo ao sacar exatamente o saldo", () => {
    const conta = new Conta("123456", 1000);

    conta.sacar(1000);

    expect(conta.saldo).toBe(0);
  });

  it("deve manter o saldo quando o saque é rejeitado", () => {
    const conta = new Conta("123456", 1000);

    expect(() => conta.sacar(1500)).toThrow();

    expect(conta.saldo).toBe(1000);
  });

  it("deve aceitar saque fracionário com duas casas decimais", () => {
    const conta = new Conta("123456", 10);

    conta.sacar(1.5);
    conta.sacar(0.25);

    expect(conta.saldo).toBe(8.25);
  });

  it.each([0, -1, 1.255, NaN, Infinity])(
    "deve rejeitar saque com valor inválido %p sem alterar o saldo",
    (valor) => {
      const conta = new Conta("123456", 1000);

      expect(() => conta.sacar(valor)).toThrow();

      expect(conta.saldo).toBe(1000);
    },
  );

  it("deve creditar o saldo ao depositar", () => {
    const conta = new Conta("123456", 1000);

    conta.depositar(500);

    expect(conta.saldo).toBe(1500);
  });

  it("deve aceitar depósito fracionário com duas casas decimais", () => {
    const conta = new Conta("123456", 1000);

    conta.depositar(1.5);

    expect(conta.saldo).toBe(1001.5);
  });

  it("deve somar depósitos fracionários sem erro de ponto flutuante", () => {
    const conta = new Conta("123456", 0);

    conta.depositar(0.1);
    conta.depositar(0.2);

    expect(conta.saldo).toBe(0.3);
  });

  it.each([0, -1, 1.255, NaN, Infinity])(
    "deve rejeitar depósito com valor inválido %p sem alterar o saldo",
    (valor) => {
      const conta = new Conta("123456", 1000);

      expect(() => conta.depositar(valor)).toThrow();

      expect(conta.saldo).toBe(1000);
    },
  );

  it("deve rejeitar depósito que ultrapasse Number.MAX_SAFE_INTEGER", () => {
    const conta = new Conta("123456", Number.MAX_SAFE_INTEGER);

    expect(() => conta.depositar(1)).toThrow();

    expect(conta.saldo).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("deve permitir criar conta com saldo inicial zero", () => {
    const conta = new Conta("123456", 0);

    expect(conta.saldo).toBe(0);
  });

  it("deve permitir criar conta com saldo inicial fracionário com duas casas decimais", () => {
    const conta = new Conta("123456", 1.5);

    expect(conta.saldo).toBe(1.5);
  });

  it.each([-1, 1.255, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    "deve rejeitar saldo inicial inválido %p",
    (saldo) => {
      expect(() => new Conta("123456", saldo)).toThrow();
    },
  );

  it("deve rejeitar conta com número inválido", () => {
    expect(() => new Conta("12345", 1000)).toThrow();
  });
});