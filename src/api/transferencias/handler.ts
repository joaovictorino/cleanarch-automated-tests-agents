import { ErroNegocio } from '../../domain/ErroNegocio';

export type DadosTransferencia = {
  contaOrigem: string;
  contaDestino: string;
  valor: number;
};

export type OperacaoTransferencia = {
  executar(
    dados: DadosTransferencia,
  ): { comprovante: string } | Promise<{ comprovante: string }>;
};

// Códigos de domínio previstos para este endpoint. Qualquer outro vira 500.
const STATUS_POR_CODIGO: Partial<Record<string, number>> = {
  CONTA_INVALIDA: 400,
  VALOR_INVALIDO: 400,
  MESMA_CONTA: 422,
  SALDO_INSUFICIENTE: 422,
  CONTA_NAO_ENCONTRADA: 404,
};

function respostaErro(codigo: string, status: number): Response {
  return Response.json({ erro: codigo }, { status });
}

function traduzirErro(erro: unknown): Response {
  if (erro instanceof ErroNegocio) {
    const status = STATUS_POR_CODIGO[erro.codigo];
    if (status !== undefined) {
      return respostaErro(erro.codigo, status);
    }
  }
  return respostaErro('ERRO_INTERNO', 500);
}

function ehObjetoJson(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

export function criarPostTransferencias(
  operacao: OperacaoTransferencia,
): (request: Request) => Promise<Response> {
  return async (request) => {
    let corpo: unknown;
    try {
      corpo = await request.json();
    } catch {
      return respostaErro('REQUISICAO_INVALIDA', 400);
    }
    if (!ehObjetoJson(corpo)) {
      return respostaErro('REQUISICAO_INVALIDA', 400);
    }

    const { contaOrigem, contaDestino, valor } = corpo;
    // Apenas tipos do contrato JSON; formato, valor e mesma conta são regras do domínio.
    if (typeof contaOrigem !== 'string' || typeof contaDestino !== 'string') {
      return respostaErro('CONTA_INVALIDA', 400);
    }
    if (typeof valor !== 'number') {
      return respostaErro('VALOR_INVALIDO', 400);
    }

    try {
      const resultado = await operacao.executar({ contaOrigem, contaDestino, valor });
      return Response.json({ comprovante: resultado.comprovante }, { status: 201 });
    } catch (erro) {
      return traduzirErro(erro);
    }
  };
}
