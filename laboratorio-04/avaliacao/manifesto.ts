import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ } from '../src/caminhos';
import type { ModoAvaliacao } from './tipos';

export type StatusExecucao = 'em_andamento' | 'concluido' | 'incompleto';

export interface Manifesto {
  runId: string;
  perfil: string;
  modo: ModoAvaliacao;
  /** True no offline: roteiros sintéticos, não medem o modelo. */
  sintetico: boolean;
  status: StatusExecucao;
  motivoIncompleto?: string;
  deployment: string | null;
  parametros: {
    maxConcurrency: number;
    cache: boolean;
    repeticoes: number;
    maxRodadas: number;
    maxRetriesCliente: number;
    parametrosOmitidos: string[];
  };
  versoes: { promptfoo: string; node: string };
  hashes: { base: string; v1: string; v2: string; dataset: string };
  casos: number;
  celulasPrevistas: number;
  celulasConcluidas: number;
  celulasAprovadas: number | null;
  codigoSaidaPromptfoo: number | null;
  iniciadoEm: string;
  finalizadoEm: string | null;
}

export const sha256 = (conteudo: string | Buffer): string => createHash('sha256').update(conteudo).digest('hex');
export const hashArquivo = (caminho: string): string => sha256(fs.readFileSync(caminho));

export function versaoPromptfoo(): string {
  const pacote: unknown = JSON.parse(fs.readFileSync(path.join(RAIZ, 'node_modules', 'promptfoo', 'package.json'), 'utf8'));
  return typeof pacote === 'object' && pacote !== null && typeof (pacote as { version?: unknown }).version === 'string'
    ? (pacote as { version: string }).version
    : 'desconhecida';
}

export function gravarManifesto(dir: string, manifesto: Manifesto): void {
  fs.writeFileSync(path.join(dir, 'manifesto.json'), `${JSON.stringify(manifesto, null, 2)}\n`, 'utf8');
}
