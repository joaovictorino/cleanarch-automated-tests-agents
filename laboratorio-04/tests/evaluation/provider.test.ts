import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { CallApiContextParams, ProviderOptions } from 'promptfoo';
import AssistenteProvider from '../../providers/assistente';
import { InfraError, type ModelClient } from '../../src/modelo/ModelClient';
import { carregarPrompt } from '../../src/prompts';
import { assistente, chamar, json, ScriptedModelClient } from '../support/ScriptedModelClient';
import { obter } from '../support/ajuda';

/** Provider com o cliente de modelo injetado; o resto do caminho é o real. */
class ProviderDeTeste extends AssistenteProvider {
  constructor(
    private readonly cliente: ModelClient,
    modo: 'offline' | 'azure' = 'offline',
  ) {
    super({ config: { modo } } as ProviderOptions);
  }
  protected override obterModelClient(): ModelClient {
    return this.cliente;
  }
}

const contexto = (caseId: string, rotulo: 'V1' | 'V2', extra: Partial<CallApiContextParams> = {}): CallApiContextParams =>
  ({
    vars: { caseId },
    // O Promptfoo compõe o rótulo como "V1: prompts/v1.txt: <texto>".
    prompt: { raw: '', label: `${rotulo}: prompts/${rotulo.toLowerCase()}.txt: texto` },
    ...extra,
  }) as CallApiContextParams;

const textoV = (v: 'v1' | 'v2') => carregarPrompt(v).texto;
const respostaPedido = json({ acao: 'pedir_dados', mensagem: 'Informe o destino.', dados: { campos: ['destinoId'] } });

describe('provider Promptfoo', () => {
  test('id identifica o modo; modo ausente ou inválido falha ao construir (nunca assume fake)', () => {
    expect(new ProviderDeTeste(new ScriptedModelClient([])).id()).toBe('assistente-bancario-offline');
    expect(() => new AssistenteProvider({} as ProviderOptions)).toThrow(/Modo de avaliação/);
    expect(() => new AssistenteProvider({ config: { modo: 'fake' } } as ProviderOptions)).toThrow(/Modo de avaliação/);
  });

  test('sucesso: output é o outputRaw sem reparo e o trace segue em metadata', async () => {
    const provider = new ProviderDeTeste(new ScriptedModelClient([assistente(respostaPedido)]));
    const r = await provider.callApi(textoV('v2'), contexto('C03', 'V2'));

    expect(r.error).toBeUndefined();
    expect(r.output).toBe(respostaPedido);
    expect(r.metadata).toMatchObject({ caseId: 'C03', versao: 'V2', backend: 'memoria', status: 'ok', avaliacao: 'offline', repeticao: 0 });
    const trace = obter(r.metadata?.trace as { caseId?: string; promptVersao?: string; backend?: string } | undefined);
    expect(trace).toMatchObject({ caseId: 'C03', promptVersao: 'v2', backend: 'memoria' });
  });

  test('invalid_output conserva o texto bruto em output (a asserção de contrato reprova depois)', async () => {
    const bruto = '```json\n{"acao":"recusar"}\n```';
    const r = await new ProviderDeTeste(new ScriptedModelClient([assistente(bruto)])).callApi(textoV('v1'), contexto('C03', 'V1'));
    expect(r.output).toBe(bruto);
    expect(r.error).toBeUndefined();
    expect(r.metadata?.status).toBe('invalid_output');
  });

  test.each<[string, ModelClient, string]>([
    ['infra_error', new ScriptedModelClient([new InfraError('AZURE_COTA', 'Cota atingida.')]), 'infra_error: AZURE_COTA'],
    ['runtime_error', new ScriptedModelClient([chamar('c', 'consultarSaldo', { contaId: '123456' })], { repetirUltimo: true }), 'runtime_error: LIMITE_RODADAS'],
  ])('%s vira erro de provider, sem output de sucesso e com o trace preservado', async (_nome, cliente, trecho) => {
    const r = await new ProviderDeTeste(cliente).callApi(textoV('v2'), contexto('C03', 'V2'));
    expect(r.output).toBeUndefined();
    expect(r.error).toContain(trecho);
    expect(r.metadata?.trace).toBeDefined();
  });

  test('uso de tokens só é informado quando o endpoint o devolveu (offline não inventa)', async () => {
    const r = await new ProviderDeTeste(new ScriptedModelClient([assistente(respostaPedido)])).callApi(textoV('v2'), contexto('C03', 'V2'));
    expect(r.tokenUsage).toBeUndefined();
  });

  test.each<[string, CallApiContextParams | undefined]>([
    ['sem contexto', undefined],
    ['rótulo desconhecido', { vars: { caseId: 'C03' }, prompt: { raw: '', label: 'V9' } } as CallApiContextParams],
    ['caseId ausente', { vars: {}, prompt: { raw: '', label: 'V1: x' } } as CallApiContextParams],
  ])('contexto inválido (%s) vira erro claro', async (_nome, ctx) => {
    const r = await new ProviderDeTeste(new ScriptedModelClient([])).callApi(textoV('v1'), ctx);
    expect(r.error).toMatch(/Contexto inválido/);
    expect(r.output).toBeUndefined();
  });

  test('caso desconhecido e texto de prompt adulterado viram erro, sem chamar o modelo', async () => {
    const modelo = new ScriptedModelClient([]);
    const provider = new ProviderDeTeste(modelo);
    expect((await provider.callApi(textoV('v1'), contexto('ZZ99', 'V1'))).error).toMatch(/Caso desconhecido/);
    expect((await provider.callApi('texto adulterado', contexto('C03', 'V1'))).error).toMatch(/não corresponde/);
    expect(modelo.requisicoes).toHaveLength(0);
  });

  test('a repetição vem do repeatIndex do Promptfoo, ou de uma contagem por caso e versão', async () => {
    const provider = new ProviderDeTeste(new ScriptedModelClient([assistente(respostaPedido)], { repetirUltimo: true }));
    expect((await provider.callApi(textoV('v2'), contexto('C03', 'V2', { repeatIndex: 2 }))).metadata?.repeticao).toBe(2);
    expect((await provider.callApi(textoV('v1'), contexto('C03', 'V1'))).metadata?.repeticao).toBe(0);
    expect((await provider.callApi(textoV('v1'), contexto('C03', 'V1'))).metadata?.repeticao).toBe(1);
  });

  test('modo azure sem variáveis falha citando só nomes e nunca chama a rede', async () => {
    const provider = new AssistenteProvider({ config: { modo: 'azure' } } as ProviderOptions);
    const r = await provider.callApi(textoV('v2'), contexto('C03', 'V2'));
    expect(r.error).toContain('AZURE_OPENAI_BASE_URL');
    expect(r.output).toBeUndefined();
  });

  describe('trace em disco', () => {
    let dir: string;
    beforeEach(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lab04-eval-'));
      process.env.AVALIACAO_DIR = dir;
      process.env.AVALIACAO_RUN_ID = 'run-teste';
    });
    afterEach(() => {
      delete process.env.AVALIACAO_DIR;
      delete process.env.AVALIACAO_RUN_ID;
      delete process.env.AZURE_OPENAI_API_KEY;
      fs.rmSync(dir, { recursive: true, force: true });
    });

    test('grava um arquivo por caso, versão e repetição, com o runId', async () => {
      const provider = new ProviderDeTeste(new ScriptedModelClient([assistente(respostaPedido)], { repetirUltimo: true }));
      await provider.callApi(textoV('v1'), contexto('C03', 'V1', { repeatIndex: 0 }));
      await provider.callApi(textoV('v2'), contexto('C03', 'V2', { repeatIndex: 1 }));

      expect(fs.readdirSync(path.join(dir, 'traces')).sort()).toEqual(['C03__V1__r0.json', 'C03__V2__r1.json']);
      const gravado = JSON.parse(fs.readFileSync(path.join(dir, 'traces', 'C03__V1__r0.json'), 'utf8')) as { runId: string; celula: { caseId: string; repeticao: number } };
      expect(gravado.runId).toBe('run-teste');
      expect(gravado.celula).toEqual({ caseId: 'C03', versao: 'V1', repeticao: 0 });
    });

    test('redige a chave conhecida no trace gravado', async () => {
      process.env.AZURE_OPENAI_API_KEY = 'chave-sintetica-para-redigir';
      const bruto = 'texto com chave-sintetica-para-redigir';
      await new ProviderDeTeste(new ScriptedModelClient([assistente(bruto)])).callApi(textoV('v2'), contexto('C03', 'V2'));
      const conteudo = fs.readFileSync(path.join(dir, 'traces', 'C03__V2__r0.json'), 'utf8');
      expect(conteudo).not.toContain('chave-sintetica-para-redigir');
      expect(conteudo).toContain('[redigido]');
    });
  });
});
