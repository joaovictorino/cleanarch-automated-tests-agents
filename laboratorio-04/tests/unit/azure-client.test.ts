import { DEFINICOES_FERRAMENTAS } from '../../src/dominio/ferramentas';
import type { Mensagem } from '../../src/dominio/contratos';
import { AzureModelClient } from '../../src/modelo/AzureModelClient';
import { InfraError } from '../../src/modelo/ModelClient';
import { obter } from '../support/ajuda';

const CONFIG = { baseURL: 'https://exemplo.invalido/openai/v1/', apiKey: 'sk-CHAVE-SINTETICA-9999', deployment: 'deployment-teste' };

interface CorpoResponses {
  model: string;
  store: boolean;
  parallel_tool_calls: boolean;
  tool_choice: string;
  tools: { type: string; name: string; parameters?: unknown }[];
  input: unknown[];
}
interface Capturada {
  url: string;
  init: RequestInit | undefined;
  corpo: CorpoResponses | null;
}

/** Fetch injetado: registra a requisição e devolve a resposta programada. Sem rede. */
function transporte(resposta: () => Response) {
  const chamadas: Capturada[] = [];
  const fn = jest.fn(async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const corpo = typeof init?.body === 'string' ? (JSON.parse(init.body) as CorpoResponses) : null;
    chamadas.push({ url: String(url), init, corpo });
    return resposta();
  });
  return { fn: fn as unknown as typeof fetch, chamar: fn, chamadas };
}

const ok = (output: unknown[], usage?: { input_tokens: number; output_tokens: number; total_tokens: number }) =>
  Response.json({ id: 'resp_1', object: 'response', status: 'completed', model: 'x', output, usage });
const erroHttp = (status: number, corpo: unknown) => Response.json(corpo, { status });
const textoFinal = (text: string) => [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] }];

const mensagens: Mensagem[] = [
  { role: 'system', content: 'regras' },
  { role: 'user', content: 'saldo da 123456?' },
  { role: 'assistant', content: null, tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'consultarSaldo', arguments: '{"contaId":"123456"}' } }] },
  { role: 'tool', tool_call_id: 'call_1', content: '{"ok":true,"contaId":"123456","saldoCentavos":10000}' },
];
const entrada = { mensagens, ferramentas: DEFINICOES_FERRAMENTAS };

describe('AzureModelClient (Responses API, transporte injetado)', () => {
  test('monta a requisição: /responses, itens de entrada, ferramentas planas, store false, sem reasoning', async () => {
    const t = transporte(() => ok(textoFinal('{}')));
    await new AzureModelClient(CONFIG, 1000, t.fn).completar(entrada);

    const { url, corpo } = obter(t.chamadas[0]);
    const c = obter(corpo);
    expect(url).toBe('https://exemplo.invalido/openai/v1/responses');
    expect(c.model).toBe('deployment-teste');
    expect(c.store).toBe(false);
    expect(c.parallel_tool_calls).toBe(false);
    expect(c.tool_choice).toBe('auto');
    expect(c).not.toHaveProperty('reasoning');
    expect(c).not.toHaveProperty('temperature');
    expect(c).not.toHaveProperty('seed');
    expect(c.tools.map((x) => [x.type, x.name])).toEqual([
      ['function', 'consultarSaldo'],
      ['function', 'simularTransferencia'],
    ]);
    expect(c.tools[0]).toHaveProperty('parameters');
    expect(c.input).toEqual([
      { role: 'system', content: 'regras' },
      { role: 'user', content: 'saldo da 123456?' },
      { type: 'function_call', call_id: 'call_1', name: 'consultarSaldo', arguments: '{"contaId":"123456"}' },
      { type: 'function_call_output', call_id: 'call_1', output: '{"ok":true,"contaId":"123456","saldoCentavos":10000}' },
    ]);
  });

  test('function_call da resposta vira tool_call com o mesmo call_id e uso de tokens', async () => {
    const t = transporte(() =>
      ok(
        [{ type: 'function_call', id: 'fc_1', call_id: 'call_XYZ', name: 'consultarSaldo', arguments: '{"contaId":"123456"}', status: 'completed' }],
        { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
      ),
    );
    const saida = await new AzureModelClient(CONFIG, 1000, t.fn).completar(entrada);

    expect(saida.mensagem.content).toBeNull();
    expect(saida.mensagem.tool_calls).toEqual([
      { id: 'call_XYZ', type: 'function', function: { name: 'consultarSaldo', arguments: '{"contaId":"123456"}' } },
    ]);
    expect(saida.uso).toEqual({ promptTokens: 10, completionTokens: 5, totalTokens: 15 });
  });

  test('output_text vira o conteúdo da mensagem do assistente, sem tool_calls', async () => {
    const t = transporte(() => ok(textoFinal('{"acao":"recusar"}')));
    const saida = await new AzureModelClient(CONFIG, 1000, t.fn).completar(entrada);
    expect(saida.mensagem).toEqual({ role: 'assistant', content: '{"acao":"recusar"}' });
  });

  test('resposta sem mensagem nem ferramenta vira AZURE_RESPOSTA_VAZIA', async () => {
    const t = transporte(() => ok([]));
    await expect(new AzureModelClient(CONFIG, 1000, t.fn).completar(entrada)).rejects.toMatchObject({ codigo: 'AZURE_RESPOSTA_VAZIA' });
  });

  test.each<[number, string]>([
    [401, 'AZURE_AUTENTICACAO'],
    [403, 'AZURE_AUTENTICACAO'],
    [429, 'AZURE_COTA'],
    [400, 'AZURE_COMPATIBILIDADE'],
    [404, 'AZURE_COMPATIBILIDADE'],
    [500, 'AZURE_ERRO'],
  ])('HTTP %i vira InfraError %s sem retry', async (status, codigo) => {
    const t = transporte(() => erroHttp(status, { error: { message: `falha com ${CONFIG.apiKey}`, code: 'x' } }));
    const erro = await new AzureModelClient(CONFIG, 1000, t.fn).completar(entrada).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(InfraError);
    const infra = erro as InfraError;
    expect(infra.codigo).toBe(codigo);
    expect(t.chamar).toHaveBeenCalledTimes(1);
    expect(`${infra.message} ${JSON.stringify(infra)}`).not.toContain(CONFIG.apiKey);
  });

  test('400 expõe só status, código e parâmetro curtos, nunca a mensagem bruta', async () => {
    const t = transporte(() => erroHttp(400, { error: { message: 'texto interno do endpoint', code: 'unsupported_value', param: 'reasoning_effort' } }));
    const erro = (await new AzureModelClient(CONFIG, 1000, t.fn).completar(entrada).catch((e: unknown) => e)) as InfraError;
    expect(erro.message).toContain('HTTP 400');
    expect(erro.message).toContain('unsupported_value');
    expect(erro.message).toContain('reasoning_effort');
    expect(erro.message).not.toContain('texto interno');
  });

  test('400 content_filter vira AZURE_FILTRO_CONTEUDO, sem culpar base URL, deployment ou a API', async () => {
    const t = transporte(() => erroHttp(400, { error: { message: 'trecho do prompt bloqueado', code: 'content_filter', param: 'prompt' } }));
    const erro = (await new AzureModelClient(CONFIG, 1000, t.fn).completar(entrada).catch((e: unknown) => e)) as InfraError;

    expect(erro).toBeInstanceOf(InfraError);
    expect(erro.codigo).toBe('AZURE_FILTRO_CONTEUDO');
    expect(erro.message).toMatch(/filtro de conteúdo/i);
    expect(erro.message).not.toMatch(/base URL|deployment|Responses API/);
    expect(erro.message).not.toContain('trecho do prompt bloqueado');
    expect(t.chamar).toHaveBeenCalledTimes(1);
  });

  test('outros 400 continuam como AZURE_COMPATIBILIDADE (só o content_filter é distinguido)', async () => {
    const t = transporte(() => erroHttp(400, { error: { message: 'x', code: 'unsupported_value', param: 'reasoning_effort' } }));
    const erro = (await new AzureModelClient(CONFIG, 1000, t.fn).completar(entrada).catch((e: unknown) => e)) as InfraError;
    expect(erro.codigo).toBe('AZURE_COMPATIBILIDADE');
  });

  test('falha de rede vira AZURE_REDE e timeout vira AZURE_TIMEOUT', async () => {
    const rede = new AzureModelClient(CONFIG, 1000, (async () => {
      throw new TypeError('fetch failed: ECONNREFUSED');
    }) as typeof fetch);
    await expect(rede.completar(entrada)).rejects.toMatchObject({ codigo: 'AZURE_REDE' });

    const lento = new AzureModelClient(
      CONFIG,
      30,
      ((_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_ok, falha) => {
          init?.signal?.addEventListener('abort', () => falha(Object.assign(new Error('aborted'), { name: 'AbortError' })));
        })) as typeof fetch,
    );
    await expect(lento.completar(entrada)).rejects.toMatchObject({ codigo: 'AZURE_TIMEOUT' });
  });

  test('a chave nunca vai no corpo da requisição', async () => {
    const t = transporte(() => ok(textoFinal('{}')));
    await new AzureModelClient(CONFIG, 1000, t.fn).completar(entrada);
    expect(String(obter(t.chamadas[0]).init?.body)).not.toContain(CONFIG.apiKey);
  });
});
