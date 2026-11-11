import type { Mensagem } from '../../src/dominio/contratos';
import type { EntradaModelo, ModelClient, SaidaModelo } from '../../src/modelo/ModelClient';

/** Um passo do roteiro: mensagem do assistente, função da requisição ou erro a lançar. */
export type ItemRoteiro = Mensagem | Error | ((entrada: EntradaModelo) => Mensagem | Error);

/**
 * Cliente de modelo injetável: devolve uma sequência explícita de mensagens do assistente e
 * registra cada requisição recebida. Não tem lógica de aprovação e não conhece dataset/oráculo.
 */
export class ScriptedModelClient implements ModelClient {
  readonly modo = 'fake' as const;
  readonly requisicoes: EntradaModelo[] = [];

  constructor(
    private readonly roteiro: ItemRoteiro[],
    private readonly opcoes: { repetirUltimo?: boolean } = {},
  ) {}

  async completar(entrada: EntradaModelo): Promise<SaidaModelo> {
    this.requisicoes.push(structuredClone(entrada));
    const indice = this.requisicoes.length - 1;
    const item = indice < this.roteiro.length ? this.roteiro[indice] : this.opcoes.repetirUltimo ? this.roteiro.at(-1) : undefined;
    if (item === undefined) throw new Error('Roteiro esgotado: o núcleo chamou o modelo mais vezes que o previsto.');
    const valor = typeof item === 'function' ? item(entrada) : item;
    if (valor instanceof Error) throw valor;
    return { mensagem: valor };
  }
}

export const assistente = (content: string): Mensagem => ({ role: 'assistant', content });

export const chamar = (id: string, nome: string, args: unknown): Mensagem => ({
  role: 'assistant',
  content: null,
  tool_calls: [{ id, type: 'function', function: { name: nome, arguments: typeof args === 'string' ? args : JSON.stringify(args) } }],
});

export const json = (obj: unknown): string => JSON.stringify(obj);
