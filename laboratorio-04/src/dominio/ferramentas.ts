import type {
  DefinicaoFerramenta,
  ErroFerramenta,
  EstadoSessao,
  NomeFerramenta,
  ResultadoFerramenta,
} from './contratos';
import { ARGUMENTOS_SCHEMAS } from './contratos';
import { GatewayError, type ContasGateway } from '../banco/ContasGateway';

export const DEFINICOES_FERRAMENTAS: DefinicaoFerramenta[] = [
  {
    type: 'function',
    function: {
      name: 'consultarSaldo',
      description: 'Consulta o saldo atual, em centavos, de uma conta autorizada da sessão.',
      parameters: ARGUMENTOS_SCHEMAS.consultarSaldo,
    },
  },
  {
    type: 'function',
    function: {
      name: 'simularTransferencia',
      description:
        'Simula uma transferência entre duas contas autorizadas e diferentes. Retorna saldos atuais e previstos em centavos. Não executa nada.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['origemId', 'destinoId', 'valorCentavos'],
        properties: {
          origemId: { type: 'string', minLength: 1 },
          destinoId: { type: 'string', minLength: 1 },
          valorCentavos: { type: 'integer', minimum: 1 },
        },
      },
    },
  },
];

export function erro(codigo: ErroFerramenta['codigo'], mensagem: string): ErroFerramenta {
  return { ok: false, codigo, mensagem };
}

const MSG_NAO_AUTORIZADO = 'Conta não autorizada para esta sessão.';

function autorizada(estado: EstadoSessao, contaId: string): boolean {
  return estado.contasAutorizadas.includes(contaId);
}

/** Lê o saldo atual de uma conta já autorizada, traduzindo falhas do gateway. */
async function lerSaldo(gateway: ContasGateway, contaId: string): Promise<number | ErroFerramenta> {
  try {
    return await gateway.obterSaldoCentavos(contaId);
  } catch (e) {
    if (e instanceof GatewayError) return erro(e.codigo, e.message);
    return erro('FONTE_INDISPONIVEL', 'A fonte de saldo está indisponível.');
  }
}

export async function consultarSaldo(
  estado: EstadoSessao,
  gateway: ContasGateway,
  args: { contaId: string },
): Promise<ResultadoFerramenta> {
  if (!autorizada(estado, args.contaId)) return erro('NAO_AUTORIZADO', MSG_NAO_AUTORIZADO);
  if (estado.falhas.consultarSaldo === 'TIMEOUT') return erro('TIMEOUT', 'A consulta excedeu o tempo limite.');
  const saldo = await lerSaldo(gateway, args.contaId);
  if (typeof saldo !== 'number') return saldo;
  return { ok: true, contaId: args.contaId, saldoCentavos: saldo };
}

/** Projeção somente leitura: dois saldos lidos e cálculo local. Nunca executa transferência. */
export async function simularTransferencia(
  estado: EstadoSessao,
  gateway: ContasGateway,
  args: { origemId: string; destinoId: string; valorCentavos: unknown },
): Promise<ResultadoFerramenta> {
  const { origemId, destinoId, valorCentavos } = args;
  if (!autorizada(estado, origemId) || !autorizada(estado, destinoId)) {
    return erro('NAO_AUTORIZADO', MSG_NAO_AUTORIZADO);
  }
  if (origemId === destinoId) return erro('DADOS_INVALIDOS', 'Origem e destino devem ser contas diferentes.');
  if (typeof valorCentavos !== 'number' || !Number.isSafeInteger(valorCentavos) || valorCentavos <= 0) {
    return erro('VALOR_INVALIDO', 'O valor deve ser um inteiro positivo em centavos.');
  }
  if (estado.falhas.simularTransferencia === 'TIMEOUT') {
    return erro('TIMEOUT', 'A simulação excedeu o tempo limite.');
  }
  const saldoOrigem = await lerSaldo(gateway, origemId);
  if (typeof saldoOrigem !== 'number') return saldoOrigem;
  const saldoDestino = await lerSaldo(gateway, destinoId);
  if (typeof saldoDestino !== 'number') return saldoDestino;
  if (saldoOrigem < valorCentavos) return erro('SALDO_INSUFICIENTE', 'Saldo insuficiente para a simulação.');
  const destinoPrevisto = saldoDestino + valorCentavos;
  if (!Number.isSafeInteger(destinoPrevisto)) return erro('VALOR_INVALIDO', 'O valor resulta em saldo fora do intervalo seguro.');
  return {
    ok: true,
    origemId,
    destinoId,
    valorCentavos,
    saldoOrigemAtualCentavos: saldoOrigem,
    saldoDestinoAtualCentavos: saldoDestino,
    saldoOrigemPrevistoCentavos: saldoOrigem - valorCentavos,
    saldoDestinoPrevistoCentavos: destinoPrevisto,
  };
}

type Executor = (estado: EstadoSessao, gateway: ContasGateway, args: never) => Promise<ResultadoFerramenta>;

export const EXECUTORES: Record<NomeFerramenta, Executor> = {
  consultarSaldo: consultarSaldo as Executor,
  simularTransferencia: simularTransferencia as Executor,
};
