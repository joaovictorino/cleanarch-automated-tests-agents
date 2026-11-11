import type { ParametrosTurno } from '../../src/assistente';
import { estadoInicial, type EstadoSessao, type Mensagem, type RespostaFinal } from '../../src/dominio/contratos';
import type { ModelClient } from '../../src/modelo/ModelClient';
import { carregarPrompt } from '../../src/prompts';
import { TraceEmMemoria } from '../../src/trace';

export { carregarPrompt, TraceEmMemoria };
export { SessionStore } from '../../src/sessoes';

/** Estado novo e independente por teste: 123456 = R$ 100,00 e 654321 = R$ 20,00 (fixture). */
export const novoEstado = (alteracoes: Partial<EstadoSessao> = {}): EstadoSessao => ({ ...estadoInicial(), ...alteracoes });

export const respostaSaldo = (contaId: string, saldoCentavos: number): RespostaFinal => ({
  acao: 'informar_saldo',
  mensagem: `O saldo da conta ${contaId} foi consultado.`,
  dados: { contaId, saldoCentavos },
});

export const respostaSimulacao = (dados: Record<string, unknown>): RespostaFinal => ({
  acao: 'simular',
  mensagem: 'Simulação concluída. Nenhuma transferência foi executada.',
  dados,
});

export const SIMULACAO_30 = {
  origemId: '123456',
  destinoId: '654321',
  valorCentavos: 3000,
  saldoOrigemAtualCentavos: 10000,
  saldoDestinoAtualCentavos: 2000,
  saldoOrigemPrevistoCentavos: 7000,
  saldoDestinoPrevistoCentavos: 5000,
};

/** Parâmetros mínimos de `executarTurno`; cada teste sobrescreve o necessário. */
export function parametrosTurno(modelClient: ModelClient, extras: Partial<ParametrosTurno> = {}): ParametrosTurno {
  return {
    mensagem: 'Qual é o saldo da conta 123456?',
    historico: [],
    estado: novoEstado(),
    prompt: carregarPrompt('v2'),
    modelClient,
    maxRodadas: 4,
    traceSink: new TraceEmMemoria(),
    ...extras,
  };
}

/** Falha o teste com mensagem clara em vez de usar `!` quando um valor deveria existir. */
export function obter<T>(valor: T | undefined | null, descricao = 'valor'): T {
  if (valor === undefined || valor === null) throw new Error(`${descricao} ausente`);
  return valor;
}

export const textoDe = (mensagens: Mensagem[]): string => mensagens.map((m) => m.content ?? '').join('\n');
