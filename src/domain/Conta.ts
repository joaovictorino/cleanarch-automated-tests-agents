import { NumeroConta } from "./NumeroConta";

export class Conta {
  readonly numero: string;
  private _saldo: number;

  constructor(numero: string, saldo: number) {
    if (!this.ehValorMonetario(saldo) || saldo < 0 || saldo > Number.MAX_SAFE_INTEGER) {
      throw new Error("Saldo inicial deve ser um valor com até duas casas decimais entre zero e Number.MAX_SAFE_INTEGER");
    }
    this.numero = new NumeroConta(numero).numero;
    this._saldo = saldo;
  }

  get saldo(): number {
    return this._saldo;
  }

  sacar(valor: number): void {
    this.validarValor(valor);
    if (valor > this._saldo) {
      throw new Error("Saldo insuficiente");
    }
    this._saldo = this.arredondar(this._saldo - valor);
  }

  depositar(valor: number): void {
    this.validarValor(valor);
    if (this._saldo + valor > Number.MAX_SAFE_INTEGER) {
      throw new Error("Depósito ultrapassa o saldo máximo permitido");
    }
    this._saldo = this.arredondar(this._saldo + valor);
  }

  private validarValor(valor: number): void {
    if (!this.ehValorMonetario(valor) || valor <= 0) {
      throw new Error("Valor deve ser um número finito com até duas casas decimais maior que zero");
    }
  }

  private ehValorMonetario(valor: number): boolean {
    return Number.isFinite(valor) && Math.abs(valor * 100 - Math.round(valor * 100)) < 1e-6;
  }

  private arredondar(valor: number): number {
    return Math.round(valor * 100) / 100;
  }
}
