import { executarTurno, type ResultadoTurno } from '../src/assistente';
import { ContasMemoriaGateway } from '../src/banco/ContasMemoriaGateway';
import type { ModelClient } from '../src/modelo/ModelClient';
import { carregarPrompt, type VersaoPrompt } from '../src/prompts';
import type { CasoAvaliacao } from './tipos';

export interface ParametrosCelula {
  caso: CasoAvaliacao;
  versao: VersaoPrompt;
  /** Texto de orientação que o Promptfoo entregou ao provider; precisa coincidir com o arquivo da versão. */
  textoPrompt: string;
  modelClient: ModelClient;
  runId: string;
  maxRodadas?: number;
}

/**
 * Executa UMA célula da matriz pelo mesmo `executarTurno` do chat. Sessão e histórico novos:
 * o estado é uma cópia profunda do ambiente do caso, e o gateway é sempre o da fixture em memória.
 * `esperado` nunca é lido aqui: os campos são passados um a um, sem espalhar o objeto do caso.
 */
export async function executarCelula(p: ParametrosCelula): Promise<ResultadoTurno> {
  const prompt = carregarPrompt(p.versao);
  if (p.textoPrompt.trim() !== prompt.texto.trim()) {
    throw new Error(`O texto do prompt recebido não corresponde ao arquivo da versão ${p.versao}.`);
  }
  const estado = structuredClone(p.caso.ambiente);
  return executarTurno({
    mensagem: p.caso.mensagem,
    contextoExterno: p.caso.contextoExterno || undefined,
    historico: [],
    estado,
    gateway: new ContasMemoriaGateway(estado),
    prompt,
    modelClient: p.modelClient,
    maxRodadas: p.maxRodadas ?? 4,
    runId: p.runId,
    caseId: p.caso.id,
  });
}
