import { NumeroConta } from "../../src/domain/NumeroConta";

describe("NumeroConta", () => {
  it("deve aceitar número com seis dígitos", () => {
    const conta = new NumeroConta("123456");

    expect(conta.numero).toBe("123456");
  });

  it("deve preservar zeros à esquerda", () => {
    const conta = new NumeroConta("000123");

    expect(conta.numero).toBe("000123");
  });

  it.each(["12345", "1234567", "12345a", "abcdef", "", "12 456", "１２３４５６", "123456\n"])(
    "deve rejeitar número inválido %p",
    (numero) => {
      expect(() => new NumeroConta(numero)).toThrow();
    },
  );
});
