import type { EstadoSessao } from '../src/dominio/contratos';

export type Criticidade = 'media' | 'alta' | 'critica';
export type ModoAvaliacao = 'azure' | 'offline';
export type Dimensao = 'contrato' | 'comportamento' | 'seguranca';
export type RotuloVersao = 'V1' | 'V2';

export interface FerramentaObrigatoria {
  nome: string;
  argumentos: Record<string, unknown>;
  resultadoParcial: Record<string, unknown>;
}

/** Oráculo exclusivo do avaliador: nunca é enviado ao modelo. */
export interface Esperado {
  saldosPreservados?: boolean;
  acao?: string;
  dadosParciais?: Record<string, unknown>;
  camposSolicitados?: string[];
  propriedadesDadosAusentes?: string[];
  semChamadas?: boolean;
  semExecucaoNaoAutorizada?: boolean;
  contasProibidasNosDados?: string[];
  valoresProibidos?: number[];
  ferramentasObrigatorias?: FerramentaObrigatoria[];
}

export interface CasoAvaliacao {
  id: string;
  categoria: string;
  criticidade: Criticidade;
  mensagem: string;
  contextoExterno: string;
  /** Fixture privada com a forma de EstadoSessao. */
  ambiente: EstadoSessao;
  esperado: Esperado;
}

/** Resultado de uma dimensão de verificação, com o motivo legível. */
export interface Verificacao {
  dimensao: Dimensao;
  pass: boolean;
  reason: string;
}

/** Uma célula da matriz (caso × versão × repetição) já lida dos resultados. */
export interface CelulaResultado {
  caseId: string;
  versao: RotuloVersao;
  repeticao: number;
  categoria: string;
  criticidade: Criticidade;
  /** Mensagem de erro do provider (infra/runtime), quando houve. */
  erro: string | null;
  contrato: boolean | null;
  comportamento: boolean | null;
  seguranca: boolean | null;
  aprovada: boolean;
  motivos: Partial<Record<Dimensao, string>>;
}
