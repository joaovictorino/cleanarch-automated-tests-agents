import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { DIR_PROMPTS } from './caminhos';

export type VersaoPrompt = 'v1' | 'v2';
export const VERSOES: readonly VersaoPrompt[] = ['v1', 'v2'];

export interface PromptSelecionado {
  versao: VersaoPrompt;
  base: string;
  texto: string;
}

export function carregarPrompt(versao: VersaoPrompt, dir: string = DIR_PROMPTS): PromptSelecionado {
  return {
    versao,
    base: fs.readFileSync(path.join(dir, 'base.txt'), 'utf8'),
    texto: fs.readFileSync(path.join(dir, `${versao}.txt`), 'utf8'),
  };
}

/** Composição idêntica em chat, smoke e avaliação: base fixa + prompt selecionado. */
export function comporInstrucao(p: PromptSelecionado): string {
  return `${p.base.trimEnd()}\n\nINSTRUÇÕES DA VERSÃO ${p.versao.toUpperCase()}\n${p.texto.trim()}`;
}

export function hashPrompt(instrucao: string): string {
  return createHash('sha256').update(instrucao).digest('hex');
}
