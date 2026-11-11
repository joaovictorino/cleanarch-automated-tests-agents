import { executarCelula } from '../../avaliacao/celula';
import { buscarCaso } from '../../avaliacao/dataset';
import type { CasoAvaliacao } from '../../avaliacao/tipos';
import { roteiroOffline } from '../../providers/roteiros-offline';
import type { ResultadoTurno } from '../../src/assistente';
import { carregarPrompt } from '../../src/prompts';
import type { Trace } from '../../src/trace';
import { ScriptedModelClient } from './ScriptedModelClient';

export const caso = (id: string): CasoAvaliacao => buscarCaso(id);

/** Executa uma célula offline pelo mesmo caminho do provider (executarCelula + roteiro sintético). */
export function executarOffline(caseId: string, versao: 'v1' | 'v2' = 'v2'): Promise<ResultadoTurno> {
  return executarCelula({
    caso: caso(caseId),
    versao,
    textoPrompt: carregarPrompt(versao).texto,
    modelClient: new ScriptedModelClient(roteiroOffline(caseId)),
    runId: 'teste',
  });
}

/** Cópia profunda editável de um trace real. */
export const clonar = (trace: Trace): Trace => structuredClone(trace);
