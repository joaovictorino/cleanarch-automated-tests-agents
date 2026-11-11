import fs from 'node:fs';
import path from 'node:path';
import Ajv, { type ValidateFunction } from 'ajv';
import { DIR_SCHEMAS } from '../caminhos';

// ---------- Mensagens (independentes do SDK) ----------
export interface ChamadaFerramentaMsg {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface Mensagem {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ChamadaFerramentaMsg[];
  tool_call_id?: string;
}

export interface DefinicaoFerramenta {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface UsoTokens {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

// ---------- Estado da sessão ----------
export type FalhaInjetada = 'TIMEOUT';

export interface EstadoSessao {
  usuarioId: string;
  contasAutorizadas: string[];
  /** Saldos em centavos; null representa fonte indisponível. */
  saldosCentavos: Record<string, number | null>;
  falhas: { consultarSaldo?: FalhaInjetada; simularTransferencia?: FalhaInjetada };
}

export function estadoInicial(): EstadoSessao {
  return {
    usuarioId: 'aluno-demo',
    contasAutorizadas: ['123456', '654321'],
    saldosCentavos: { '123456': 10000, '654321': 2000 },
    falhas: {},
  };
}

/** Backend `http`: saldos vêm da aplicação bancária; o estado guarda só identidade e autorização. */
export function estadoParaBackendHttp(contasAutorizadas: string[]): EstadoSessao {
  return { usuarioId: 'aluno-demo', contasAutorizadas: [...contasAutorizadas], saldosCentavos: {}, falhas: {} };
}

// ---------- Ferramentas ----------
export const NOMES_FERRAMENTAS = ['consultarSaldo', 'simularTransferencia'] as const;
export type NomeFerramenta = (typeof NOMES_FERRAMENTAS)[number];

export type CodigoErroFerramenta =
  | 'NAO_AUTORIZADO'
  | 'DADOS_INVALIDOS'
  | 'VALOR_INVALIDO'
  | 'SALDO_INSUFICIENTE'
  | 'FONTE_INDISPONIVEL'
  | 'TIMEOUT'
  | 'FERRAMENTA_PROIBIDA';

export interface ErroFerramenta {
  ok: false;
  codigo: CodigoErroFerramenta;
  mensagem: string;
}

export interface SucessoConsulta {
  ok: true;
  contaId: string;
  saldoCentavos: number;
}

export interface SucessoSimulacao {
  ok: true;
  origemId: string;
  destinoId: string;
  valorCentavos: number;
  saldoOrigemAtualCentavos: number;
  saldoDestinoAtualCentavos: number;
  saldoOrigemPrevistoCentavos: number;
  saldoDestinoPrevistoCentavos: number;
}

export type ResultadoFerramenta = SucessoConsulta | SucessoSimulacao | ErroFerramenta;

export type StatusChamada =
  | 'pending'
  | 'blocked_by_policy'
  | 'invalid_arguments'
  | 'tool_error'
  | 'executed';

export interface RegistroChamada {
  toolCallId: string;
  nome: string;
  argumentosBrutos: string;
  argumentosValidados: Record<string, unknown> | null;
  status: StatusChamada;
  resultado: ResultadoFerramenta | null;
}

// ---------- Argumentos (Ajv) ----------
const ajvArgs = new Ajv({ allErrors: false, strict: true });

export const ARGUMENTOS_SCHEMAS: Record<NomeFerramenta, Record<string, unknown>> = {
  consultarSaldo: {
    type: 'object',
    additionalProperties: false,
    required: ['contaId'],
    properties: { contaId: { type: 'string', minLength: 1 } },
  },
  simularTransferencia: {
    type: 'object',
    additionalProperties: false,
    required: ['origemId', 'destinoId', 'valorCentavos'],
    properties: {
      origemId: { type: 'string', minLength: 1 },
      destinoId: { type: 'string', minLength: 1 },
      // O tipo do valor é verificado no código para distinguir VALOR_INVALIDO de DADOS_INVALIDOS.
      valorCentavos: {},
    },
  },
};

export const validadoresArgumentos: Record<NomeFerramenta, ValidateFunction> = {
  consultarSaldo: ajvArgs.compile(ARGUMENTOS_SCHEMAS.consultarSaldo),
  simularTransferencia: ajvArgs.compile(ARGUMENTOS_SCHEMAS.simularTransferencia),
};

// ---------- Resposta final ----------
export const CAMINHO_SCHEMA_RESPOSTA = path.join(DIR_SCHEMAS, 'resposta.schema.json');

export interface RespostaFinal {
  acao: 'informar_saldo' | 'simular' | 'pedir_dados' | 'recusar' | 'informar_falha';
  mensagem: string;
  dados: Record<string, unknown>;
}

const validadorResposta: ValidateFunction = new Ajv({ strict: true }).compile(
  JSON.parse(fs.readFileSync(CAMINHO_SCHEMA_RESPOSTA, 'utf8')),
);

export type ValidacaoResposta =
  | { valida: true; resposta: RespostaFinal }
  | { valida: false; motivo: string };

/** Valida sem retirar cercas Markdown, completar dados ou reescrever nada. */
export function validarRespostaFinal(outputRaw: string): ValidacaoResposta {
  let parsed: unknown;
  try {
    parsed = JSON.parse(outputRaw);
  } catch {
    return { valida: false, motivo: 'A saída não é um JSON válido.' };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { valida: false, motivo: 'A saída não é um único objeto JSON.' };
  }
  if (!validadorResposta(parsed)) {
    const primeiro = validadorResposta.errors?.[0];
    const onde = primeiro?.instancePath || '(raiz)';
    return { valida: false, motivo: `A saída não segue o contrato: ${onde} ${primeiro?.message ?? ''}`.trim() };
  }
  return { valida: true, resposta: parsed as RespostaFinal };
}

// ---------- Resultado do turno ----------
export type StatusTurno = 'ok' | 'invalid_output' | 'infra_error' | 'runtime_error';

export interface ErroSanitizado {
  codigo: string;
  mensagem: string;
}
