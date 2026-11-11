import fs from 'node:fs';
import path from 'node:path';
import { extrairCelulas, renderizarComparacao, resumir, type Resumo } from './comparacao';
import type { ModoAvaliacao } from './tipos';

export interface PlanoManifesto {
  runId: string;
  perfil: string;
  modo: ModoAvaliacao;
  casos: number;
  repeticoes: number;
}

/** Lê `resultados.json` e gera `resumo.json` e `COMPARACAO.md` em `dir`. Retorna se os artefatos ficaram completos. */
export function gerarComparacao(dir: string, plano: PlanoManifesto): { completo: boolean; concluidas: number; previstas: number; resumo: Resumo } {
  const arquivo = path.join(dir, 'resultados.json');
  const bruto: unknown = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  const celulas = extrairCelulas(bruto);
  const resumo = resumir(celulas, plano);
  fs.writeFileSync(path.join(dir, 'resumo.json'), `${JSON.stringify(resumo, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(dir, 'COMPARACAO.md'), renderizarComparacao(resumo, celulas, { runId: plano.runId, perfil: plano.perfil }), 'utf8');
  return { completo: resumo.concluidas === resumo.previstas, concluidas: resumo.concluidas, previstas: resumo.previstas, resumo };
}
