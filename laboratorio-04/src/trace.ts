import fs from 'node:fs';
import path from 'node:path';
import type {
  DefinicaoFerramenta,
  ErroSanitizado,
  Mensagem,
  RegistroChamada,
  StatusTurno,
  UsoTokens,
} from './dominio/contratos';
import { DIR_TRACES } from './caminhos';
import type { ChamadaBanco } from './banco/ContasGateway';

export interface RodadaTrace {
  rodada: number;
  /** Mensagens efetivamente enviadas ao modelo nesta rodada. */
  mensagens: Mensagem[];
  resposta: Mensagem;
  uso?: UsoTokens;
}

export interface Trace {
  traceId: string;
  runId?: string;
  caseId?: string;
  promptVersao: string;
  promptHash: string;
  modo: 'azure' | 'fake';
  backend: 'http' | 'memoria';
  /** Chamadas à aplicação bancária (método, caminho, status, duração). */
  chamadasBanco: ChamadaBanco[];
  deployment: string | null;
  parametrosOmitidos: string[];
  status: StatusTurno;
  rodadas: RodadaTrace[];
  ferramentas: DefinicaoFerramenta[];
  chamadas: RegistroChamada[];
  saldosAntes: Record<string, number | null>;
  saldosDepois: Record<string, number | null>;
  outputRaw: string | null;
  resposta: unknown;
  erro: ErroSanitizado | null;
  duracaoMs: number;
  uso: UsoTokens | null;
}

export interface TraceSink {
  /** Retorna o caminho gravado, quando houver. */
  gravar(trace: Trace): string | undefined;
}

/** Remove segredos conhecidos de qualquer texto antes de persistir ou expor. */
export function redigir(texto: string, segredos: readonly string[]): string {
  let saida = texto;
  for (const segredo of segredos) {
    if (segredo.length >= 4) saida = saida.split(segredo).join('[redigido]');
  }
  return saida;
}

export class TraceEmArquivo implements TraceSink {
  constructor(
    private readonly dir: string = DIR_TRACES,
    private readonly segredos: readonly string[] = [],
  ) {}

  gravar(trace: Trace): string | undefined {
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      const arquivo = path.join(this.dir, `${trace.traceId}.json`);
      fs.writeFileSync(arquivo, redigir(JSON.stringify(trace, null, 2), this.segredos), 'utf8');
      return arquivo;
    } catch {
      return undefined; // falha de gravação não derruba o chat
    }
  }
}

/** Sink em memória para o ensaio e para testes futuros. */
export class TraceEmMemoria implements TraceSink {
  readonly traces: Trace[] = [];
  gravar(trace: Trace): undefined {
    this.traces.push(trace);
    return undefined;
  }
}
