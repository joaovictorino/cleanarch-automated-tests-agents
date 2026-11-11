import { carregarConfig, ConfigError } from '../src/config';

export const VARIAVEIS_AZURE = ['AZURE_OPENAI_BASE_URL', 'AZURE_OPENAI_API_KEY', 'AZURE_OPENAI_DEPLOYMENT'] as const;

/**
 * Azure exige as três variáveis. Retorna uma mensagem que cita só NOMES (nunca valores) ou null
 * se estiver tudo certo. Nunca há queda silenciosa para o modo offline.
 */
export function validarAzure(env: Record<string, string | undefined>): string | null {
  const ausentes = VARIAVEIS_AZURE.filter((n) => !env[n]?.trim());
  if (ausentes.length > 0) return `Configuração Azure incompleta. Preencha no .env: ${ausentes.join(', ')}.`;
  try {
    carregarConfig({ ...env, MODEL_PROVIDER: 'azure', BANCO_BACKEND: 'memoria' });
  } catch (e) {
    return e instanceof ConfigError ? e.message : 'Configuração Azure inválida.';
  }
  return null;
}

/** Remove do ambiente do subprocesso tudo o que é do Azure: o offline nunca enxerga credenciais. */
export function ambienteSemAzure<T extends Record<string, string | undefined>>(env: T): T {
  const copia: Record<string, string | undefined> = { ...env };
  for (const nome of Object.keys(copia)) if (/^(AZURE_|MODEL_PROVIDER$)/.test(nome)) delete copia[nome];
  return copia as T;
}
