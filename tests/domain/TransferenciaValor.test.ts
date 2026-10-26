import { Conta } from "../../src/domain/Conta";
import { TransferenciaValor } from "../../src/domain/TransferenciaValor";

describe("TransferenciaValor", () => {
  const gerador = (): string => "000042";

  it("deve debitar a origem, creditar o destino e retornar o comprovante", () => {
    const origem = new Conta("123456", 10000);
    const destino = new Conta("654321", 2000);

    const recibo = new TransferenciaValor(gerador).transferir(origem, destino, 3000);

    expect(origem.saldo).toBe(7000);
    expect(destino.saldo).toBe(5000);
    expect(recibo.codigo).toBe("000042");
  });

  it("deve aceitar transferência com saldo exatamente suficiente", () => {
    const origem = new Conta("123456", 3000);
    const destino = new Conta("654321", 1000);

    const recibo = new TransferenciaValor(gerador).transferir(origem, destino, 3000);

    expect(origem.saldo).toBe(0);
    expect(destino.saldo).toBe(4000);
    expect(recibo.codigo).toBe("000042");
  });

  it("deve usar o gerador padrão de Recibo quando nenhum é informado", () => {
    const origem = new Conta("123456", 10000);
    const destino = new Conta("654321", 2000);

    const recibo = new TransferenciaValor().transferir(origem, destino, 3000);

    expect(recibo.codigo).toMatch(/^[0-9]{6}$/);
  });

  it("deve rejeitar transferência com saldo insuficiente mantendo os saldos", () => {
    const origem = new Conta("123456", 2000);
    const destino = new Conta("654321", 5000);

    expect(() => new TransferenciaValor(gerador).transferir(origem, destino, 3000)).toThrow(
      "Saldo insuficiente",
    );

    expect(origem.saldo).toBe(2000);
    expect(destino.saldo).toBe(5000);
  });

  it("deve transferir valor fracionário com duas casas decimais", () => {
    const origem = new Conta("123456", 10);
    const destino = new Conta("654321", 0.25);

    new TransferenciaValor(gerador).transferir(origem, destino, 1.5);

    expect(origem.saldo).toBe(8.5);
    expect(destino.saldo).toBe(1.75);
  });

  it.each([0, -1, 1.255, NaN, Infinity])(
    "deve rejeitar transferência com valor inválido %p mantendo os saldos",
    (valor) => {
      const origem = new Conta("123456", 10000);
      const destino = new Conta("654321", 2000);

      expect(() => new TransferenciaValor(gerador).transferir(origem, destino, valor)).toThrow();

      expect(origem.saldo).toBe(10000);
      expect(destino.saldo).toBe(2000);
    },
  );

  it("deve rejeitar transferência para a própria conta mantendo o saldo", () => {
    const origem = new Conta("123456", 10000);
    const mesmaConta = new Conta("123456", 10000);

    expect(() => new TransferenciaValor(gerador).transferir(origem, mesmaConta, 3000)).toThrow();

    expect(origem.saldo).toBe(10000);
    expect(mesmaConta.saldo).toBe(10000);
  });

  it.each(["12345", "abcdef", ""])(
    "deve rejeitar transferência quando o gerador produz o código inválido %p, mantendo os saldos",
    (codigo) => {
      const origem = new Conta("123456", 10000);
      const destino = new Conta("654321", 2000);

      expect(() => new TransferenciaValor(() => codigo).transferir(origem, destino, 3000)).toThrow();

      expect(origem.saldo).toBe(10000);
      expect(destino.saldo).toBe(2000);
    },
  );

  it("deve restaurar a origem quando o crédito no destino falha", () => {
    const origem = new Conta("123456", 10000);
    const destino = new Conta("654321", Number.MAX_SAFE_INTEGER);

    expect(() => new TransferenciaValor(gerador).transferir(origem, destino, 3000)).toThrow();

    expect(origem.saldo).toBe(10000);
    expect(destino.saldo).toBe(Number.MAX_SAFE_INTEGER);
  });
});
