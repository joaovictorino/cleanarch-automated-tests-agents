import { ErroNegocio } from '../../src/domain/ErroNegocio';
import {
  criarOperacaoTransferenciaPostgres,
  criarOperacoesContasPostgres,
  type ClienteSql,
  type PoolSql,
  type ResultadoConsulta,
} from '../../src/application/postgres/operacoes';

type Chamada = { texto: string; valores?: unknown[] };

function criarFake(saldos: Record<string, number>, falharEm?: string) {
  const chamadas: Chamada[] = [];
  const liberou = { valor: false };
  const responder = async (texto: string, valores?: unknown[]): Promise<ResultadoConsulta> => {
    chamadas.push({ texto, valores });
    if (falharEm && texto.startsWith(falharEm)) {
      throw Object.assign(new Error('falha'), { code: falharEm === 'INSERT' ? '23505' : 'XX000' });
    }
    if (texto.startsWith('SELECT numero, saldo FROM contas WHERE numero = ANY')) {
      const nums = (valores?.[0] ?? []) as string[];
      return {
        rows: nums.filter((n) => n in saldos).map((n) => ({ numero: n, saldo: String(saldos[n]) })),
      };
    }
    return { rows: [] };
  };
  const cliente: ClienteSql = { query: responder, release: () => (liberou.valor = true) };
  const pool: PoolSql = { query: responder, connect: async () => cliente };
  return { pool, chamadas, liberou };
}

describe('operações PostgreSQL (cliente simulado)', () => {
  test('transfere e persiste os dois saldos na mesma transação', async () => {
    const { pool, chamadas, liberou } = criarFake({ '123456': 1000, '654321': 200 });
    const op = criarOperacaoTransferenciaPostgres(pool, () => '123456');

    const r = await op.executar({ contaOrigem: '123456', contaDestino: '654321', valor: 300 });

    expect(r.comprovante).toBe('123456');
    const textos = chamadas.map((c) => c.texto.split(' ')[0]);
    expect(textos).toEqual(['BEGIN', 'SELECT', 'UPDATE', 'UPDATE', 'COMMIT']);
    expect(chamadas[2].valores).toEqual(['123456', 700]);
    expect(chamadas[3].valores).toEqual(['654321', 500]);
    expect(liberou.valor).toBe(true);
  });

  test('conta inexistente faz ROLLBACK e lança CONTA_NAO_ENCONTRADA', async () => {
    const { pool, chamadas } = criarFake({ '123456': 1000 });
    const op = criarOperacaoTransferenciaPostgres(pool);

    await expect(
      op.executar({ contaOrigem: '123456', contaDestino: '654321', valor: 10 }),
    ).rejects.toMatchObject({ codigo: 'CONTA_NAO_ENCONTRADA' });
    expect(chamadas.at(-1)?.texto).toBe('ROLLBACK');
  });

  test('saldo insuficiente faz ROLLBACK sem UPDATE', async () => {
    const { pool, chamadas } = criarFake({ '123456': 50, '654321': 200 });
    const op = criarOperacaoTransferenciaPostgres(pool);

    await expect(
      op.executar({ contaOrigem: '123456', contaDestino: '654321', valor: 300 }),
    ).rejects.toBeInstanceOf(ErroNegocio);
    expect(chamadas.some((c) => c.texto.startsWith('UPDATE'))).toBe(false);
    expect(chamadas.at(-1)?.texto).toBe('ROLLBACK');
  });

  test('violação de unicidade vira CONTA_JA_EXISTE', async () => {
    const { pool } = criarFake({}, 'INSERT');
    const ops = criarOperacoesContasPostgres(pool);

    await expect(ops.criar({ numero: '123456', saldoInicial: 10 })).rejects.toMatchObject({
      codigo: 'CONTA_JA_EXISTE',
    });
  });
});
