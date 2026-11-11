import fs from 'node:fs';
import path from 'node:path';
import { redigir, type Trace } from '../src/trace';

export interface IdentificacaoCelula {
  caseId: string;
  versao: string;
  repeticao: number;
}

export function nomeTrace(c: IdentificacaoCelula): string {
  return `${c.caseId}__${c.versao}__r${c.repeticao}.json`;
}

/** Grava o trace de uma célula em <dir>/traces/, redigindo segredos conhecidos. Retorna o caminho. */
export function gravarTraceCelula(dir: string, celula: IdentificacaoCelula, trace: Trace, segredos: readonly string[] = []): string {
  const destino = path.join(dir, 'traces');
  fs.mkdirSync(destino, { recursive: true });
  const arquivo = path.join(destino, nomeTrace(celula));
  fs.writeFileSync(arquivo, redigir(JSON.stringify({ celula, ...trace }, null, 2), segredos), 'utf8');
  return arquivo;
}
