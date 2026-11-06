import type { ContaDTO, OperacoesContas } from '../../api/contas/handlers';
import type { OperacaoTransferencia } from '../../api/transferencias/handler';
import { Conta } from '../../domain/Conta';
import { ErroNegocio } from '../../domain/ErroNegocio';
import { NumeroConta } from '../../domain/NumeroConta';
import { Recibo } from '../../domain/Recibo';
import { TransferenciaValor } from '../../domain/TransferenciaValor';
import { validarTransferencia } from '../transferencias/operacao';

export interface ResultadoConsulta {
  rows: Array<Record<string, unknown>>;
}

export interface ClienteSql {
  query(texto: string, valores?: unknown[]): Promise<ResultadoConsulta>;
  release(): void;
}

export interface PoolSql {
  query(texto: string, valores?: unknown[]): Promise<ResultadoConsulta>;
  connect(): Promise<ClienteSql>;
}

const UNIQUE_VIOLATION = '23505';

function paraDTO(linha: Record<string, unknown>): ContaDTO {
  return { numero: String(linha.numero), saldo: Number(linha.saldo) };
}

export function criarOperacoesContasPostgres(pool: PoolSql): OperacoesContas {
  return {
    async criar({ numero, saldoInicial }) {
      new NumeroConta(numero);
      const conta = new Conta(numero, saldoInicial);
      try {
        await pool.query('INSERT INTO contas (numero, saldo) VALUES ($1, $2)', [
          conta.numero,
          conta.saldo,
        ]);
      } catch (erro) {
        if ((erro as { code?: string }).code === UNIQUE_VIOLATION) {
          throw new ErroNegocio('CONTA_JA_EXISTE', 'Já existe uma conta com este número');
        }
        throw erro;
      }
      return { numero: conta.numero, saldo: conta.saldo };
    },

    async listar() {
      const r = await pool.query('SELECT numero, saldo FROM contas ORDER BY numero');
      return r.rows.map(paraDTO);
    },

    async consultar(id) {
      const numero = new NumeroConta(id).numero;
      const r = await pool.query('SELECT numero, saldo FROM contas WHERE numero = $1', [numero]);
      return r.rows[0] === undefined ? undefined : paraDTO(r.rows[0]);
    },
  };
}

export function criarOperacaoTransferenciaPostgres(
  pool: PoolSql,
  gerarCodigo: () => string = Recibo.gerarCodigoAleatorio,
): OperacaoTransferencia {
  const transferencia = new TransferenciaValor(gerarCodigo);

  return {
    async executar({ contaOrigem, contaDestino, valor }) {
      const { numeroOrigem, numeroDestino } = validarTransferencia(contaOrigem, contaDestino, valor);

      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        // Ordem fixa por número evita deadlock entre transferências cruzadas.
        const r = await cliente.query(
          'SELECT numero, saldo FROM contas WHERE numero = ANY($1) ORDER BY numero FOR UPDATE',
          [[numeroOrigem, numeroDestino]],
        );
        const saldos = new Map(r.rows.map((l) => [String(l.numero), Number(l.saldo)]));
        const saldoOrigem = saldos.get(numeroOrigem);
        const saldoDestino = saldos.get(numeroDestino);
        if (saldoOrigem === undefined || saldoDestino === undefined) {
          throw new ErroNegocio('CONTA_NAO_ENCONTRADA', 'Conta de origem ou destino não cadastrada');
        }

        const origem = new Conta(numeroOrigem, saldoOrigem);
        const destino = new Conta(numeroDestino, saldoDestino);
        const recibo = transferencia.transferir(origem, destino, valor);

        await cliente.query('UPDATE contas SET saldo = $2 WHERE numero = $1', [
          numeroOrigem,
          origem.saldo,
        ]);
        await cliente.query('UPDATE contas SET saldo = $2 WHERE numero = $1', [
          numeroDestino,
          destino.saldo,
        ]);
        await cliente.query('COMMIT');
        return { comprovante: recibo.codigo };
      } catch (erro) {
        await cliente.query('ROLLBACK');
        throw erro;
      } finally {
        cliente.release();
      }
    },
  };
}
