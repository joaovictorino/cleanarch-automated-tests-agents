import OpenAI from 'openai';
import type { ResponseInputItem } from 'openai/resources/responses/responses';
import type { AzureConfig } from '../config';
import type { ChamadaFerramentaMsg, Mensagem } from '../dominio/contratos';
import { InfraError, type EntradaModelo, type ModelClient, type SaidaModelo } from './ModelClient';

/** Único ponto de chamada ao Azure (Responses API, base OpenAI v1, sem api-version). */
export class AzureModelClient implements ModelClient {
  readonly modo = 'azure' as const;
  readonly deployment: string;
  private readonly cliente: OpenAI;

  /** `transporte` permite injetar o fetch nos testes do adaptador, sem rede. */
  constructor(config: AzureConfig, timeoutMs: number, transporte?: typeof fetch) {
    this.deployment = config.deployment;
    this.cliente = new OpenAI({
      baseURL: config.baseURL,
      apiKey: config.apiKey,
      timeout: timeoutMs,
      maxRetries: 0,
      ...(transporte ? { fetch: transporte } : {}),
    });
  }

  async completar(entrada: EntradaModelo): Promise<SaidaModelo> {
    try {
      // Responses API: o deployment não aceita function tools em Chat Completions.
      // Sem temperature, seed, response_format ou reasoning: reduz variação entre modelos.
      const resposta = await this.cliente.responses.create({
        model: this.deployment,
        input: paraItensResponses(entrada.mensagens),
        tools: entrada.ferramentas.map((f) => ({
          type: 'function' as const,
          name: f.function.name,
          description: f.function.description,
          parameters: f.function.parameters,
          strict: false,
        })),
        tool_choice: 'auto',
        parallel_tool_calls: false,
        store: false,
      });

      const textos: string[] = [];
      const toolCalls: ChamadaFerramentaMsg[] = [];
      for (const item of resposta.output ?? []) {
        if (item.type === 'message') {
          for (const parte of item.content) if (parte.type === 'output_text') textos.push(parte.text);
        } else if (item.type === 'function_call') {
          toolCalls.push({ id: item.call_id, type: 'function', function: { name: item.name, arguments: item.arguments } });
        }
      }
      if (textos.length === 0 && toolCalls.length === 0) {
        throw new InfraError('AZURE_RESPOSTA_VAZIA', 'O endpoint não retornou uma mensagem.');
      }
      return {
        mensagem: {
          role: 'assistant',
          content: textos.length > 0 ? textos.join('') : null,
          ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        },
        uso: resposta.usage
          ? {
              promptTokens: resposta.usage.input_tokens,
              completionTokens: resposta.usage.output_tokens,
              totalTokens: resposta.usage.total_tokens,
            }
          : undefined,
      };
    } catch (e) {
      throw traduzirErro(e);
    }
  }
}

/** Converte o histórico independente de SDK para os itens da Responses API. */
function paraItensResponses(mensagens: Mensagem[]): ResponseInputItem[] {
  const itens: ResponseInputItem[] = [];
  for (const m of mensagens) {
    if (m.role === 'tool') {
      itens.push({ type: 'function_call_output', call_id: m.tool_call_id ?? '', output: m.content ?? '' });
      continue;
    }
    if (m.content) itens.push({ role: m.role, content: m.content });
    for (const tc of m.tool_calls ?? []) {
      itens.push({ type: 'function_call', call_id: tc.id, name: tc.function.name, arguments: tc.function.arguments });
    }
  }
  return itens;
}

/** Nunca repassa a mensagem do SDK: ela pode conter detalhes do endpoint. */
function traduzirErro(e: unknown): InfraError {
  if (e instanceof InfraError) return e;
  if (e instanceof OpenAI.APIConnectionTimeoutError) {
    return new InfraError('AZURE_TIMEOUT', 'O endpoint do modelo excedeu o tempo limite.');
  }
  if (e instanceof OpenAI.APIConnectionError) {
    return new InfraError('AZURE_REDE', 'Não foi possível conectar ao endpoint do modelo.');
  }
  if (e instanceof OpenAI.APIError) {
    const status = e.status;
    if (status === 401 || status === 403) {
      return new InfraError('AZURE_AUTENTICACAO', 'O endpoint recusou a autenticação. Verifique chave e permissões.');
    }
    if (status === 429) return new InfraError('AZURE_COTA', 'Cota ou limite de taxa do endpoint atingido.');
    if (status === 400 && e.code === 'content_filter') {
      // O filtro de conteúdo do Azure bloqueou o prompt antes do modelo. Não é erro de configuração,
      // então não manda revisar base URL/deployment. Continua infraestrutura: nunca vira resposta aprovada.
      return new InfraError(
        'AZURE_FILTRO_CONTEUDO',
        'O filtro de conteúdo do endpoint bloqueou a requisição antes de o modelo responder. Não indica erro de configuração.',
      );
    }
    if (status === 400 || status === 404 || status === 422) {
      // Só status HTTP, código e parâmetro (identificadores curtos); nunca a mensagem bruta.
      const curto = (v: unknown) => (typeof v === 'string' && /^[\w.\-]{1,60}$/.test(v) ? v : undefined);
      const detalhes = [`HTTP ${status}`, curto(e.code), curto(e.param) && `param: ${curto(e.param)}`]
        .filter(Boolean)
        .join(', ');
      return new InfraError(
        'AZURE_COMPATIBILIDADE',
        `O endpoint rejeitou a requisição (${detalhes}). Verifique base URL, deployment e suporte à Responses API com function calling.`,
      );
    }
    return new InfraError('AZURE_ERRO', `O endpoint do modelo retornou um erro${status ? ` (HTTP ${status})` : ''}.`);
  }
  return new InfraError('AZURE_ERRO', 'Falha inesperada ao chamar o modelo.');
}
