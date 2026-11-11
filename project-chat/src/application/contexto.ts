import { criarEstado, criarGateway, criarModelClient, segredosDe } from '../fabrica';
import { carregarConfig, ConfigError } from '../config';
import { DIR_TRACES } from '../caminhos';
import { SessionStore } from '../sessoes';
import { TraceEmArquivo } from '../trace';
import type { ChatDeps } from '../api/chat/handlers';

const global = globalThis as typeof globalThis & { __chatDeps?: ChatDeps };

/**
 * Composição preguiçosa e memoizada em globalThis: nada é criado no import nem no build, e as
 * sessões sobrevivem à recarga de módulos do `next dev`.
 */
export function obterDeps(): ChatDeps {
  if (!global.__chatDeps) {
    const config = carregarConfig();
    global.__chatDeps = {
      modelClient: criarModelClient(config),
      sessoes: new SessionStore(),
      maxRodadas: config.maxRodadas,
      traceSink: new TraceEmArquivo(DIR_TRACES, segredosDe(config)),
      novoEstado: () => criarEstado(config),
      criarGateway: (estado) => criarGateway(config, estado),
    };
  }
  return global.__chatDeps;
}

/** Erro de configuração vira 500 com os nomes das variáveis, nunca seus valores. */
export function respostaDeConfiguracao(e: unknown): Response {
  const mensagem = e instanceof ConfigError ? e.message : 'Falha ao inicializar o servidor.';
  return Response.json({ erro: { codigo: 'CONFIGURACAO_INVALIDA', mensagem } }, { status: 500 });
}
