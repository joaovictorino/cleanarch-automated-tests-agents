import type { EstadoSessao } from '../dominio/contratos';
import { GatewayError, type ChamadaBanco, type ContasGateway } from './ContasGateway';

/** Fixture em memória: lê `EstadoSessao.saldosCentavos`. Usado por testes, avaliação e smoke offline. */
export class ContasMemoriaGateway implements ContasGateway {
  readonly backend = 'memoria' as const;
  readonly chamadas: readonly ChamadaBanco[] = [];

  constructor(private readonly estado: EstadoSessao) {}

  async obterSaldoCentavos(numero: string): Promise<number> {
    const saldo = this.estado.saldosCentavos[numero];
    if (saldo === null || saldo === undefined) {
      throw new GatewayError('FONTE_INDISPONIVEL', 'A fonte de saldo está indisponível.');
    }
    return saldo;
  }
}
