import { AzureModelClient } from './modelo/AzureModelClient';
import { FakeModelClient } from './modelo/FakeModelClient';
import type { ModelClient } from './modelo/ModelClient';
import type { Config } from './config';
import type { ContasGateway } from './banco/ContasGateway';
import { ContasHttpGateway } from './banco/ContasHttpGateway';
import { ContasMemoriaGateway } from './banco/ContasMemoriaGateway';
import { estadoInicial, estadoParaBackendHttp, type EstadoSessao } from './dominio/contratos';

/** Estado inicial de uma sessão conforme o backend de contas. */
export function criarEstado(config: Config): EstadoSessao {
  return config.banco.backend === 'http' ? estadoParaBackendHttp(config.banco.contasAutorizadas) : estadoInicial();
}

/** Um gateway por turno, para o trace registrar só as chamadas daquele turno. */
export function criarGateway(config: Config, estado: EstadoSessao): ContasGateway {
  return config.banco.backend === 'http'
    ? new ContasHttpGateway(config.banco.baseURL, config.banco.timeoutMs)
    : new ContasMemoriaGateway(estado);
}

export function criarModelClient(config: Config): ModelClient {
  if (config.provedor === 'azure' && config.azure) {
    return new AzureModelClient(config.azure, config.timeoutMs);
  }
  return new FakeModelClient();
}

/** Segredos a redigir de traces. */
export function segredosDe(config: Config): string[] {
  return config.azure ? [config.azure.apiKey] : [];
}
