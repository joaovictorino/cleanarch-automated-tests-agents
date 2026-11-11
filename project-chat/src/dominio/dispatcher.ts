import type {
  ChamadaFerramentaMsg,
  EstadoSessao,
  NomeFerramenta,
  RegistroChamada,
  ResultadoFerramenta,
} from './contratos';
import { NOMES_FERRAMENTAS, validadoresArgumentos } from './contratos';
import { erro, EXECUTORES } from './ferramentas';
import type { ContasGateway } from '../banco/ContasGateway';

export interface Dispatcher {
  executar(chamada: ChamadaFerramentaMsg): Promise<ResultadoFerramenta>;
  readonly chamadas: RegistroChamada[];
}

function ehNomeConhecido(nome: string): nome is NomeFerramenta {
  return (NOMES_FERRAMENTAS as readonly string[]).includes(nome);
}

/**
 * Registra toda tentativa ANTES de validar e executar. Autorização e validação ficam aqui,
 * no código; os prompts V1/V2 não alteram essa política.
 */
export function criarDispatcher(estado: EstadoSessao, gateway: ContasGateway): Dispatcher {
  const chamadas: RegistroChamada[] = [];

  async function executar(chamada: ChamadaFerramentaMsg): Promise<ResultadoFerramenta> {
    const registro: RegistroChamada = {
      toolCallId: chamada.id,
      nome: chamada.function.name,
      argumentosBrutos: chamada.function.arguments,
      argumentosValidados: null,
      status: 'pending',
      resultado: null,
    };
    chamadas.push(registro);

    const concluir = (status: RegistroChamada['status'], resultado: ResultadoFerramenta) => {
      registro.status = status;
      registro.resultado = resultado;
      return resultado;
    };

    if (!ehNomeConhecido(registro.nome)) {
      return concluir('blocked_by_policy', erro('FERRAMENTA_PROIBIDA', 'Ferramenta não disponível.'));
    }
    const nome = registro.nome;

    let args: unknown;
    try {
      args = JSON.parse(registro.argumentosBrutos);
    } catch {
      return concluir('invalid_arguments', erro('DADOS_INVALIDOS', 'Argumentos não são um JSON válido.'));
    }
    const validar = validadoresArgumentos[nome];
    if (typeof args !== 'object' || args === null || Array.isArray(args) || !validar(args)) {
      return concluir('invalid_arguments', erro('DADOS_INVALIDOS', 'Argumentos fora do contrato da ferramenta.'));
    }
    registro.argumentosValidados = args as Record<string, unknown>;

    const resultado = await EXECUTORES[nome](estado, gateway, args as never);
    if (resultado.ok) return concluir('executed', resultado);
    if (resultado.codigo === 'NAO_AUTORIZADO') return concluir('blocked_by_policy', resultado);
    if (resultado.codigo === 'DADOS_INVALIDOS' || resultado.codigo === 'VALOR_INVALIDO') {
      return concluir('invalid_arguments', resultado);
    }
    return concluir('tool_error', resultado);
  }

  return { executar, chamadas };
}
