import { Conta } from "./Conta";
import { Recibo } from "./Recibo";

export class TransferenciaValor {
  private readonly gerarCodigo: () => string;

  constructor(gerarCodigo: () => string = Recibo.gerarCodigoAleatorio) {
    this.gerarCodigo = gerarCodigo;
  }

  transferir(origem: Conta, destino: Conta, valor: number): Recibo {
    if (origem.numero === destino.numero) {
      throw new Error("Conta de origem e destino devem ser diferentes");
    }
    const recibo = new Recibo(this.gerarCodigo());

    origem.sacar(valor);
    try {
      destino.depositar(valor);
    } catch (erro) {
      origem.depositar(valor);
      throw erro;
    }
    return recibo;
  }
}
