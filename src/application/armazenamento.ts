import type { OperacoesContas } from '../api/contas/handlers';
import type { OperacaoTransferencia } from '../api/transferencias/handler';
import { criarOperacoesContas } from './contas/operacoes';
import { contasDemonstracao } from './estado-contas';
import { criarOperacaoTransferencia } from './transferencias/operacao';
import {
  criarOperacaoTransferenciaPostgres,
  criarOperacoesContasPostgres,
  type PoolSql,
} from './postgres/operacoes';

export interface OperacoesAplicacao {
  contas: OperacoesContas;
  transferencias: OperacaoTransferencia;
}

type Ambiente = Record<string, string | undefined>;

function criarMemoria(): OperacoesAplicacao {
  return {
    contas: criarOperacoesContas(contasDemonstracao),
    transferencias: criarOperacaoTransferencia(contasDemonstracao),
  };
}

async function criarPostgres(env: Ambiente): Promise<OperacoesAplicacao> {
  const url = env.DATABASE_URL;
  if (!url) {
    throw new Error('CONTAS_STORAGE=postgres exige DATABASE_URL');
  }
  // Import dinâmico: o módulo pg só é carregado quando o PostgreSQL é escolhido.
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: url }) as unknown as PoolSql;
  return {
    contas: criarOperacoesContasPostgres(pool),
    transferencias: criarOperacaoTransferenciaPostgres(pool),
  };
}

// Seleção pelo servidor; DATABASE_URL sozinha nunca ativa o PostgreSQL.
export function criarOperacoesAplicacao(env: Ambiente = process.env): Promise<OperacoesAplicacao> {
  const modo = env.CONTAS_STORAGE ?? 'memory';
  if (modo === 'memory') return Promise.resolve(criarMemoria());
  if (modo === 'postgres') return criarPostgres(env);
  return Promise.reject(new Error(`CONTAS_STORAGE inválido: ${modo} (use memory ou postgres)`));
}

const globalComOperacoes = globalThis as typeof globalThis & {
  __operacoesAplicacao?: Promise<OperacoesAplicacao>;
};

// Memoizado e preguiçoso: nada é criado no import nem no build.
export function obterOperacoes(): Promise<OperacoesAplicacao> {
  return (globalComOperacoes.__operacoesAplicacao ??= criarOperacoesAplicacao());
}

// Delegates usados pelas rotas: resolvem o armazenamento só na primeira requisição.
export const operacoesContasDaAplicacao: OperacoesContas = {
  criar: async (dados) => (await obterOperacoes()).contas.criar(dados),
  listar: async () => (await obterOperacoes()).contas.listar(),
  consultar: async (id) => (await obterOperacoes()).contas.consultar(id),
};

export const operacaoTransferenciaDaAplicacao: OperacaoTransferencia = {
  executar: async (dados) => (await obterOperacoes()).transferencias.executar(dados),
};
