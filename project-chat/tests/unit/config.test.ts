import { carregarConfig, ConfigError, normalizarBancoUrl, normalizarBaseUrl } from '../../src/config';

type Env = Record<string, string | undefined>;

const AZURE: Env = {
  MODEL_PROVIDER: 'azure',
  AZURE_OPENAI_BASE_URL: 'https://recurso.openai.azure.com/openai/v1',
  AZURE_OPENAI_API_KEY: 'chave-sintetica-123',
  AZURE_OPENAI_DEPLOYMENT: 'dep',
};

describe('configuração', () => {
  test('padrões: fake, backend http, contas 123456/654321', () => {
    const c = carregarConfig({});
    expect(c).toMatchObject({ provedor: 'fake', timeoutMs: 20000, maxRodadas: 4 });
    expect(c.banco).toEqual({ backend: 'http', baseURL: 'http://127.0.0.1:3000', timeoutMs: 5000, contasAutorizadas: ['123456', '654321'] });
    expect(c.azure).toBeUndefined();
  });

  test('Azure incompleto falha citando os nomes ausentes, sem revelar valores', () => {
    let erro: unknown;
    try {
      carregarConfig({ MODEL_PROVIDER: 'azure', AZURE_OPENAI_API_KEY: 'chave-sintetica-123' });
    } catch (e) {
      erro = e;
    }
    expect(erro).toBeInstanceOf(ConfigError);
    const mensagem = (erro as ConfigError).message;
    expect(mensagem).toContain('AZURE_OPENAI_BASE_URL');
    expect(mensagem).toContain('AZURE_OPENAI_DEPLOYMENT');
    expect(mensagem).not.toContain('chave-sintetica-123');
  });

  test('Azure completo normaliza a base e guarda a chave só na configuração Azure', () => {
    const c = carregarConfig(AZURE);
    expect(c.azure).toEqual({ baseURL: 'https://recurso.openai.azure.com/openai/v1/', apiKey: 'chave-sintetica-123', deployment: 'dep' });
  });

  test.each<[string, string]>([
    ['URL completa /chat/completions', 'https://r.openai.azure.com/openai/v1/chat/completions'],
    ['caminho /models', 'https://r.openai.azure.com/openai/v1/models'],
    ['URL de projeto', 'https://r.services.ai.azure.com/api/projects/p/openai/v1/'],
    ['query string', 'https://r.openai.azure.com/openai/v1/?api-version=1'],
    ['HTTP sem TLS', 'http://r.openai.azure.com/openai/v1/'],
    ['credenciais embutidas', 'https://u:s@r.openai.azure.com/openai/v1/'],
    ['caminho diferente de /openai/v1', 'https://r.openai.azure.com/outro/'],
    ['texto que não é URL', 'nao-e-url'],
  ])('base Azure inválida (%s) é rejeitada', (_nome, url) => {
    expect(() => normalizarBaseUrl(url)).toThrow(ConfigError);
  });

  test.each<[string, Env]>([
    ['provedor desconhecido', { MODEL_PROVIDER: 'openai' }],
    ['backend desconhecido', { BANCO_BACKEND: 'mongo' }],
    ['timeout inválido', { AZURE_OPENAI_TIMEOUT_MS: 'abc' }],
    ['rodadas zero', { ASSISTANT_MAX_ROUNDS: '0' }],
    ['contas com item vazio', { CHAT_CONTAS_AUTORIZADAS: '123456,,654321' }],
    ['contas repetidas', { CHAT_CONTAS_AUTORIZADAS: '123456,123456' }],
  ])('%s é rejeitado', (_nome, env) => {
    expect(() => carregarConfig(env)).toThrow(ConfigError);
  });

  test.each<[string, string]>([
    ['host externo', 'http://banco.exemplo.com:3000'],
    ['caminho', 'http://127.0.0.1:3000/api'],
    ['protocolo ftp', 'ftp://127.0.0.1'],
    ['credenciais', 'http://u:s@127.0.0.1:3000'],
  ])('base da aplicação bancária com %s é rejeitada', (_nome, url) => {
    expect(() => normalizarBancoUrl(url)).toThrow(ConfigError);
  });

  test('base bancária localhost é normalizada para a origem', () => {
    expect(normalizarBancoUrl('http://localhost:3000/')).toBe('http://localhost:3000');
  });
});
