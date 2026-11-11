import type { DefinicaoFerramenta, Mensagem, UsoTokens } from '../dominio/contratos';

export interface EntradaModelo {
  mensagens: Mensagem[];
  ferramentas: DefinicaoFerramenta[];
}

export interface SaidaModelo {
  /** Mensagem do assistente, possivelmente com tool_calls. */
  mensagem: Mensagem;
  uso?: UsoTokens;
}

/** Falha de rede, autenticação, cota ou compatibilidade. Mensagem já sanitizada. */
export class InfraError extends Error {
  constructor(
    public readonly codigo: string,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = 'InfraError';
  }
}

/** Contrato injetável: não conhece Express, casos de teste, oráculos nem Promptfoo. */
export interface ModelClient {
  readonly modo: 'azure' | 'fake';
  /** Deployment declarado (somente Azure). */
  readonly deployment?: string;
  completar(entrada: EntradaModelo): Promise<SaidaModelo>;
}
