import { Recibo } from "../../src/domain/Recibo";

describe("Recibo", () => {
  it("deve aceitar código com seis dígitos", () => {
    const recibo = new Recibo("000123");

    expect(recibo.codigo).toBe("000123");
  });

  it.each(["12345", "1234567", "12345a", "", "123456\n"])(
    "deve rejeitar código inválido %p",
    (codigo) => {
      expect(() => new Recibo(codigo)).toThrow();
    },
  );

  describe("gerarCodigoAleatorio", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("deve gerar seis dígitos com zeros à esquerda", () => {
      jest.spyOn(Math, "random").mockReturnValue(0);

      expect(Recibo.gerarCodigoAleatorio()).toBe("000000");
    });

    it("deve gerar um código aceito pelo Recibo", () => {
      const codigo = Recibo.gerarCodigoAleatorio();

      expect(new Recibo(codigo).codigo).toBe(codigo);
    });
  });
});
