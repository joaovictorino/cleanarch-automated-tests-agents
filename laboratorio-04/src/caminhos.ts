import fs from 'node:fs';
import path from 'node:path';

/** Raiz de laboratorio-04: primeiro diretório, a partir do cwd, que contém package.json. */
function acharRaiz(): string {
  let dir = process.cwd();
  while (!fs.existsSync(path.join(dir, 'package.json'))) {
    const pai = path.dirname(dir);
    if (pai === dir) throw new Error('Raiz do projeto não encontrada.');
    dir = pai;
  }
  return dir;
}

export const RAIZ = acharRaiz();
export const DIR_PROMPTS = path.join(RAIZ, 'prompts');
export const DIR_SCHEMAS = path.join(RAIZ, 'schemas');
export const DIR_TRACES = path.join(RAIZ, 'traces');
