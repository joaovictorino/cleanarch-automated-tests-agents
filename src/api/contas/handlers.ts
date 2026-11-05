import { ErroNegocio } from '../../domain/ErroNegocio';

export type DadosCriacaoConta = { numero: string; saldoInicial: number };
export type ContaDTO = { numero: string; saldo: number };

export type OperacoesContas = {
  criar(dados: DadosCriacaoConta): ContaDTO | Promise<ContaDTO>;
  listar(): ContaDTO[] | Promise<ContaDTO[]>;
  consultar(id: string): ContaDTO | undefined | Promise<ContaDTO | undefined>;
};

const STATUS_POR_CODIGO: Partial<Record<string, number>> = {
  CONTA_INVALIDA: 400,
  SALDO_INVALIDO: 400,
  CONTA_JA_EXISTE: 409,
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

function compararPorNumero(a: ContaDTO, b: ContaDTO): number {
  if (a.numero === b.numero) return 0;
  return a.numero < b.numero ? -1 : 1;
}

export function criarPostContas(
  operacoes: OperacoesContas,
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

    const { numero, saldoInicial } = corpo;
    if (typeof numero !== 'string') {
      return respostaErro('CONTA_INVALIDA', 400);
    }
    if (typeof saldoInicial !== 'number') {
      return respostaErro('SALDO_INVALIDO', 400);
    }

    try {
      const conta = await operacoes.criar({ numero, saldoInicial });
      return Response.json(conta, {
        status: 201,
        headers: { Location: `/api/contas/${conta.numero}` },
      });
    } catch (erro) {
      return traduzirErro(erro);
    }
  };
}

export function criarGetContas(
  operacoes: OperacoesContas,
): (request: Request) => Promise<Response> {
  return async () => {
    try {
      const contas = await operacoes.listar();
      const ordenadas = contas
        .map(({ numero, saldo }) => ({ numero, saldo }))
        .sort(compararPorNumero);
      return Response.json({ contas: ordenadas });
    } catch (erro) {
      return traduzirErro(erro);
    }
  };
}

export function criarGetContaPorId(
  operacoes: OperacoesContas,
): (request: Request, id: string) => Promise<Response> {
  return async (_request, id) => {
    try {
      const conta = await operacoes.consultar(id);
      if (conta === undefined) {
        return respostaErro('CONTA_NAO_ENCONTRADA', 404);
      }
      return Response.json({ numero: conta.numero, saldo: conta.saldo });
    } catch (erro) {
      return traduzirErro(erro);
    }
  };
}
