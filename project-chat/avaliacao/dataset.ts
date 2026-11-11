import fs from 'node:fs';
import path from 'node:path';
import { RAIZ } from '../src/caminhos';
import type { CasoAvaliacao } from './tipos';

export const ARQUIVOS_DATASET = ['casos.json', 'ajuste.json'] as const;
export type ArquivoDataset = (typeof ARQUIVOS_DATASET)[number];

const CRITICIDADES = ['media', 'alta', 'critica'];

function ehObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Valida o formato de um caso; falha com mensagem clara em vez de avaliar dados malformados. */
export function validarCaso(bruto: unknown, origem: string): CasoAvaliacao {
  if (!ehObjeto(bruto)) throw new Error(`${origem}: caso não é um objeto`);
  const falta = (campo: string) => new Error(`${origem}: campo "${campo}" ausente ou inválido`);
  const { id, categoria, criticidade, mensagem, contextoExterno, ambiente, esperado } = bruto;
  if (typeof id !== 'string' || id === '') throw falta('id');
  if (typeof categoria !== 'string') throw falta('categoria');
  if (typeof criticidade !== 'string' || !CRITICIDADES.includes(criticidade)) throw falta('criticidade');
  if (typeof mensagem !== 'string' || mensagem === '') throw falta('mensagem');
  if (typeof contextoExterno !== 'string') throw falta('contextoExterno');
  if (!ehObjeto(esperado)) throw falta('esperado');
  if (!ehObjeto(ambiente)) throw falta('ambiente');
  if (
    typeof ambiente.usuarioId !== 'string' ||
    !Array.isArray(ambiente.contasAutorizadas) ||
    !ehObjeto(ambiente.saldosCentavos) ||
    !ehObjeto(ambiente.falhas)
  ) {
    throw falta('ambiente (usuarioId, contasAutorizadas, saldosCentavos, falhas)');
  }
  return bruto as unknown as CasoAvaliacao;
}

export function carregarArquivo(arquivo: ArquivoDataset, dir: string = path.join(RAIZ, 'dataset')): CasoAvaliacao[] {
  const bruto: unknown = JSON.parse(fs.readFileSync(path.join(dir, arquivo), 'utf8'));
  if (!Array.isArray(bruto)) throw new Error(`${arquivo}: esperado um array de casos`);
  const casos = bruto.map((c, i) => validarCaso(c, `${arquivo}[${i}]`));
  const ids = casos.map((c) => c.id);
  if (new Set(ids).size !== ids.length) throw new Error(`${arquivo}: ids de casos repetidos`);
  return casos;
}

/** Todos os casos conhecidos (avaliação e ajuste), usados pelas asserções para achar o oráculo por caseId. */
export function carregarTodos(dir?: string): CasoAvaliacao[] {
  return ARQUIVOS_DATASET.flatMap((a) => carregarArquivo(a, dir));
}

export function buscarCaso(caseId: string, dir?: string): CasoAvaliacao {
  const caso = carregarTodos(dir).find((c) => c.id === caseId);
  if (!caso) throw new Error(`Caso desconhecido: ${caseId}`);
  return caso;
}
