import { randomUUID } from 'node:crypto';
import { estadoInicial, type EstadoSessao, type Mensagem } from './dominio/contratos';

export const MAX_TURNOS_HISTORICO = 10;

export interface Sessao {
  id: string;
  estado: EstadoSessao;
  /** Cada turno é uma sequência completa (user, assistant+tool_calls, tool..., assistant final). */
  historico: Mensagem[][];
}

export class SessionStore {
  private readonly sessoes = new Map<string, Sessao>();

  criar(estado: EstadoSessao = estadoInicial()): Sessao {
    const sessao: Sessao = { id: randomUUID(), estado, historico: [] };
    this.sessoes.set(sessao.id, sessao);
    return sessao;
  }

  obter(id: string): Sessao | undefined {
    return this.sessoes.get(id);
  }

  descartar(id: string): void {
    this.sessoes.delete(id);
  }

  /** Acrescenta um turno completo e mantém só os últimos 10, sem cortar sequências. */
  registrarTurno(sessao: Sessao, mensagens: Mensagem[]): void {
    sessao.historico.push(mensagens);
    if (sessao.historico.length > MAX_TURNOS_HISTORICO) {
      sessao.historico.splice(0, sessao.historico.length - MAX_TURNOS_HISTORICO);
    }
  }
}
