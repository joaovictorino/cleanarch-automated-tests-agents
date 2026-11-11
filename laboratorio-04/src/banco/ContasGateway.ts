import type { CodigoErroFerramenta } from '../dominio/contratos';

/** Registro de uma chamada à aplicação bancária: sem corpo, sem URL completa, sem mensagens. */
export interface ChamadaBanco {
  metodo: 'GET';
  caminho: string;
  status: number | null;
  duracaoMs: number;
}

/** Falha já traduzida para um código de ferramenta; a mensagem é segura para o modelo. */
export class GatewayError extends Error {
  constructor(
    public readonly codigo: Extract<CodigoErroFerramenta, 'DADOS_INVALIDOS' | 'TIMEOUT' | 'FONTE_INDISPONIVEL'>,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = 'GatewayError';
  }
}

/** Leitura de contas injetável. Só leitura: nenhuma implementação executa transferência. */
export interface ContasGateway {
  readonly backend: 'http' | 'memoria';
  /** Saldo atual da conta em centavos inteiros. Lança GatewayError. */
  obterSaldoCentavos(numero: string): Promise<number>;
  /** Chamadas HTTP feitas até agora (vazio no backend em memória). */
  readonly chamadas: readonly ChamadaBanco[];
}
