import type { AssertionValueFunctionContext, GradingResult } from 'promptfoo';
import { buscarCaso } from '../avaliacao/dataset';
import type { CasoAvaliacao, Verificacao } from '../avaliacao/tipos';
import type { Trace } from '../src/trace';

export function paraGrading(v: Verificacao): GradingResult {
  return { pass: v.pass, score: v.pass ? 1 : 0, reason: v.reason, namedScores: { [v.dimensao]: v.pass ? 1 : 0 } };
}

export interface EntradaAsserção {
  caso: CasoAvaliacao;
  /** Trace do núcleo; undefined quando o provider não o devolveu (reprova as asserções que o exigem). */
  trace: Trace | undefined;
}

/** O oráculo é achado pelo `caseId`: o provider só recebe esse identificador, nunca `esperado`. */
export function entradaDe(context: AssertionValueFunctionContext): EntradaAsserção {
  const caseId = context.vars.caseId;
  if (typeof caseId !== 'string') throw new Error('Variável caseId ausente na asserção.');
  const meta = context.metadata ?? context.providerResponse?.metadata;
  const bruto: unknown = meta?.trace;
  const trace = typeof bruto === 'object' && bruto !== null ? (bruto as Trace) : undefined;
  return { caso: buscarCaso(caseId), trace };
}

/** Subconjunto estrutural: todo campo de `parcial` existe em `real` com valor profundamente igual. */
export function contem(parcial: Record<string, unknown>, real: Record<string, unknown>, igual: (a: unknown, b: unknown) => boolean): string[] {
  return Object.entries(parcial)
    .filter(([chave, valor]) => !(chave in real) || !igual(real[chave], valor))
    .map(([chave]) => chave);
}

/**
 * Igualdade estrutural de valores JSON. Não usa `util.isDeepStrictEqual`, que compara protótipos
 * e falha entre realms (Jest) ou após serialização; aqui só valem valores e chaves.
 */
export function igual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return Number.isNaN(a) && Number.isNaN(b);
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => igual(x, b[i]));
  const oa = a as Record<string, unknown>;
  const ob = b as Record<string, unknown>;
  const chaves = Object.keys(oa);
  return chaves.length === Object.keys(ob).length && chaves.every((k) => k in ob && igual(oa[k], ob[k]));
}

export interface RespostaTolerante {
  acao: string;
  mensagem: string;
  dados: Record<string, unknown>;
}

/**
 * Leitura tolerante: extrai acao/mensagem/dados de qualquer JSON objeto, mesmo fora do schema
 * (campo extra, tipo errado). Segurança e comportamento não podem depender de o contrato ter passado.
 */
export function lerTolerante(outputRaw: string | null | undefined): RespostaTolerante | null {
  if (typeof outputRaw !== 'string') return null;
  let bruto: unknown;
  try {
    bruto = JSON.parse(outputRaw);
  } catch {
    return null;
  }
  if (typeof bruto !== 'object' || bruto === null || Array.isArray(bruto)) return null;
  const o = bruto as Record<string, unknown>;
  if (typeof o.acao !== 'string' || typeof o.dados !== 'object' || o.dados === null || Array.isArray(o.dados)) return null;
  return { acao: o.acao, mensagem: typeof o.mensagem === 'string' ? o.mensagem : '', dados: o.dados as Record<string, unknown> };
}
