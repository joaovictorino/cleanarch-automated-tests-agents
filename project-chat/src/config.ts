export type Provedor = 'fake' | 'azure';

export interface AzureConfig {
  baseURL: string;
  apiKey: string;
  deployment: string;
}

export type BackendBanco = 'http' | 'memoria';

export interface BancoConfig {
  backend: BackendBanco;
  baseURL: string;
  timeoutMs: number;
  contasAutorizadas: string[];
}

export interface Config {
  provedor: Provedor;
  timeoutMs: number;
  maxRodadas: number;
  banco: BancoConfig;
  azure?: AzureConfig;
}

/** Erro de configuração. A mensagem cita nomes de variáveis, nunca valores. */
export class ConfigError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ConfigError';
  }
}

type Env = Record<string, string | undefined>;

function inteiroPositivo(env: Env, nome: string, padrao: number): number {
  const bruto = env[nome]?.trim();
  if (!bruto) return padrao;
  if (!/^[0-9]+$/.test(bruto) || Number(bruto) <= 0) {
    throw new ConfigError(`${nome} deve ser um inteiro positivo.`);
  }
  return Number(bruto);
}

/** Valida a base OpenAI v1; só acrescenta a barra final quando necessário. */
export function normalizarBaseUrl(bruta: string): string {
  let url: URL;
  try {
    url = new URL(bruta);
  } catch {
    throw new ConfigError('AZURE_OPENAI_BASE_URL não é uma URL válida.');
  }
  if (url.protocol !== 'https:') {
    throw new ConfigError('AZURE_OPENAI_BASE_URL deve usar HTTPS.');
  }
  if (url.search || url.hash) {
    throw new ConfigError('AZURE_OPENAI_BASE_URL não pode conter query string nem fragmento.');
  }
  if (url.username || url.password) {
    throw new ConfigError('AZURE_OPENAI_BASE_URL não pode conter credenciais.');
  }
  const caminho = url.pathname.replace(/\/+$/, '');
  if (/\/chat\/completions$/.test(caminho)) {
    throw new ConfigError('AZURE_OPENAI_BASE_URL deve ser a base /openai/v1/, não a URL completa /chat/completions.');
  }
  if (/\/models(\/|$)/.test(caminho)) {
    throw new ConfigError('AZURE_OPENAI_BASE_URL deve ser a base /openai/v1/, não um caminho /models.');
  }
  if (/\/api\/projects(\/|$)|\/projects\//.test(caminho)) {
    throw new ConfigError('AZURE_OPENAI_BASE_URL deve ser a base do recurso (/openai/v1/), não uma URL de projeto.');
  }
  if (caminho !== '/openai/v1') {
    throw new ConfigError('AZURE_OPENAI_BASE_URL deve terminar em /openai/v1/.');
  }
  return `${url.origin}/openai/v1/`;
}

/** Base da aplicação bancária: http(s), somente localhost/127.0.0.1, sem credenciais, query ou caminho. */
export function normalizarBancoUrl(bruta: string): string {
  let url: URL;
  try {
    url = new URL(bruta);
  } catch {
    throw new ConfigError('BANCO_API_BASE_URL não é uma URL válida.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ConfigError('BANCO_API_BASE_URL deve usar http ou https.');
  }
  if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    throw new ConfigError('BANCO_API_BASE_URL deve apontar para localhost ou 127.0.0.1.');
  }
  if (url.username || url.password || url.search || url.hash || url.pathname.replace(/\/+$/, '') !== '') {
    throw new ConfigError('BANCO_API_BASE_URL deve ser somente origem (sem credenciais, caminho, query ou fragmento).');
  }
  return url.origin;
}

function carregarBanco(env: Env): BancoConfig {
  const backend = (env.BANCO_BACKEND?.trim() || 'http').toLowerCase();
  if (backend !== 'http' && backend !== 'memoria') {
    throw new ConfigError('BANCO_BACKEND deve ser "http" ou "memoria".');
  }
  const contas = (env.CHAT_CONTAS_AUTORIZADAS?.trim() || '123456,654321')
    .split(',')
    .map((c) => c.trim());
  if (contas.some((c) => c === '') || new Set(contas).size !== contas.length) {
    throw new ConfigError('CHAT_CONTAS_AUTORIZADAS deve listar contas não vazias e sem repetição, separadas por vírgula.');
  }
  return {
    backend,
    baseURL: normalizarBancoUrl(env.BANCO_API_BASE_URL?.trim() || 'http://127.0.0.1:3000'),
    timeoutMs: inteiroPositivo(env, 'BANCO_API_TIMEOUT_MS', 5000),
    contasAutorizadas: contas,
  };
}

export function carregarConfig(env: Env = process.env): Config {
  const provedorBruto = (env.MODEL_PROVIDER?.trim() || 'fake').toLowerCase();
  if (provedorBruto !== 'fake' && provedorBruto !== 'azure') {
    throw new ConfigError('MODEL_PROVIDER deve ser "fake" ou "azure".');
  }
  const base: Config = {
    provedor: provedorBruto,
    timeoutMs: inteiroPositivo(env, 'AZURE_OPENAI_TIMEOUT_MS', 20000),
    maxRodadas: inteiroPositivo(env, 'ASSISTANT_MAX_ROUNDS', 4),
    banco: carregarBanco(env),
  };
  if (base.provedor === 'fake') return base;

  const exigidas = ['AZURE_OPENAI_BASE_URL', 'AZURE_OPENAI_API_KEY', 'AZURE_OPENAI_DEPLOYMENT'];
  const ausentes = exigidas.filter((nome) => !env[nome]?.trim());
  if (ausentes.length > 0) {
    throw new ConfigError(`Configuração Azure incompleta. Preencha no .env: ${ausentes.join(', ')}.`);
  }
  return {
    ...base,
    azure: {
      baseURL: normalizarBaseUrl(env.AZURE_OPENAI_BASE_URL!.trim()),
      apiKey: env.AZURE_OPENAI_API_KEY!.trim(),
      deployment: env.AZURE_OPENAI_DEPLOYMENT!.trim(),
    },
  };
}
