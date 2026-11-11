import path from 'node:path';
import type { ApiProvider, CallApiContextParams, ProviderOptions, ProviderResponse } from 'promptfoo';
import { executarCelula } from '../avaliacao/celula';
import { buscarCaso } from '../avaliacao/dataset';
import { gravarTraceCelula } from '../avaliacao/evidencias';
import type { ModoAvaliacao, RotuloVersao } from '../avaliacao/tipos';
import { carregarConfig, ConfigError } from '../src/config';
import { criarModelClient } from '../src/fabrica';
import type { ModelClient } from '../src/modelo/ModelClient';
import type { VersaoPrompt } from '../src/prompts';
import { ScriptedModelClient } from '../tests/support/ScriptedModelClient';
import { roteiroOffline } from './roteiros-offline';

const ROTULOS: Record<string, VersaoPrompt> = { V1: 'v1', V2: 'v2' };

/** O Promptfoo compõe o rótulo como "V1: prompts/v1.txt: <texto>"; só o prefixo é a versão. */
function rotuloDe(labelCompleto: string): string {
  return /^(V1|V2)(?::|$)/.exec(labelCompleto)?.[1] ?? '';
}

function modoDe(valor: unknown): ModoAvaliacao {
  if (valor === 'azure' || valor === 'offline') return valor;
  throw new Error('Modo de avaliação ausente ou inválido. Use npm run eval (Azure) ou npm run eval:offline.');
}

/**
 * Provider Promptfoo: cada chamada é UMA célula (caso × versão × repetição) e invoca o mesmo
 * `executarTurno` do chat. `output` é o `outputRaw` sem reparo; o trace segue em `metadata`.
 * O provider só recebe `caseId` como variável: o oráculo (`esperado`) nunca chega aqui.
 */
export default class AssistenteProvider implements ApiProvider {
  private readonly modo: ModoAvaliacao;
  private clienteAzure: ModelClient | null = null;
  private readonly contagem = new Map<string, number>();

  constructor(opcoes: ProviderOptions = {}) {
    this.modo = modoDe((opcoes.config as { modo?: unknown } | undefined)?.modo);
  }

  id(): string {
    return `assistente-bancario-${this.modo}`;
  }

  protected obterModelClient(caseId: string): ModelClient {
    if (this.modo === 'offline') return new ScriptedModelClient(roteiroOffline(caseId));
    // Mesmo cliente do chat; backend de contas sempre em memória na avaliação.
    this.clienteAzure ??= criarModelClient(carregarConfig({ ...process.env, MODEL_PROVIDER: 'azure', BANCO_BACKEND: 'memoria' }));
    return this.clienteAzure;
  }

  async callApi(prompt: string, context?: CallApiContextParams): Promise<ProviderResponse> {
    const caseId = context?.vars.caseId;
    const rotulo = rotuloDe(context?.prompt.label ?? '');
    const versao = ROTULOS[rotulo];
    if (typeof caseId !== 'string' || !versao) {
      return { error: `Contexto inválido: caseId=${String(caseId)} rótulo=${rotulo} (esperado V1 ou V2).` };
    }

    const chaveCelula = `${caseId}:${versao}`;
    const repeticao = context?.repeatIndex ?? this.contagem.get(chaveCelula) ?? 0;
    this.contagem.set(chaveCelula, repeticao + 1);

    try {
      const runId = process.env.AVALIACAO_RUN_ID ?? 'sem-run-id';
      const resultado = await executarCelula({
        caso: buscarCaso(caseId),
        versao,
        textoPrompt: prompt,
        modelClient: this.obterModelClient(caseId),
        runId,
      });

      const dir = process.env.AVALIACAO_DIR;
      const segredos = process.env.AZURE_OPENAI_API_KEY ? [process.env.AZURE_OPENAI_API_KEY] : [];
      if (dir) gravarTraceCelula(path.resolve(dir), { caseId, versao: rotulo, repeticao }, resultado.trace, segredos);

      const metadata = {
        trace: resultado.trace,
        modo: resultado.modo,
        avaliacao: this.modo,
        backend: resultado.backend,
        versao: rotulo,
        caseId,
        runId,
        repeticao,
        status: resultado.status,
      };
      const uso = resultado.trace.uso;
      const tokenUsage = uso ? { prompt: uso.promptTokens, completion: uso.completionTokens, total: uso.totalTokens } : undefined;

      if (resultado.status === 'infra_error' || resultado.status === 'runtime_error') {
        // Não preenche `output` de sucesso após uma exceção.
        return { error: `${resultado.status}: ${resultado.erro?.codigo ?? 'erro'}: ${resultado.erro?.mensagem ?? ''}`, metadata };
      }
      return { output: resultado.outputRaw ?? '', metadata, ...(tokenUsage ? { tokenUsage } : {}), latencyMs: resultado.trace.duracaoMs };
    } catch (e) {
      return { error: e instanceof ConfigError ? e.message : `Falha ao executar a célula: ${e instanceof Error ? e.message : 'erro'}` };
    }
  }
}

export type { RotuloVersao };
