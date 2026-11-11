import { GatewayError, type ChamadaBanco, type ContasGateway } from './ContasGateway';

export type FetchLike = (url: string, init: { method: 'GET'; headers: Record<string, string>; signal: AbortSignal; redirect: 'error' }) => Promise<{
  status: number;
  json(): Promise<unknown>;
}>;

/**
 * Integração real com a aplicação bancária (Next.js, Aulas 01–03). Somente GET /api/contas/{id}.
 * Nunca chama POST /api/transferencias, que executa a transferência.
 */
export class ContasHttpGateway implements ContasGateway {
  readonly backend = 'http' as const;
  private readonly registro: ChamadaBanco[] = [];

  constructor(
    private readonly baseURL: string,
    private readonly timeoutMs: number,
    private readonly executarFetch: FetchLike = fetch as unknown as FetchLike,
  ) {}

  get chamadas(): readonly ChamadaBanco[] {
    return this.registro;
  }

  async obterSaldoCentavos(numero: string): Promise<number> {
    const caminho = `/api/contas/${encodeURIComponent(numero)}`;
    const inicio = Date.now();
    let status: number | null = null;
    try {
      const resposta = await this.executarFetch(`${this.baseURL}${caminho}`, {
        method: 'GET',
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(this.timeoutMs),
        redirect: 'error',
      });
      status = resposta.status;
      const corpo = await resposta.json().catch(() => null);
      return this.interpretar(numero, status, corpo);
    } catch (e) {
      if (e instanceof GatewayError) throw e;
      const nome = (e as { name?: string } | null)?.name;
      if (nome === 'TimeoutError' || nome === 'AbortError') {
        throw new GatewayError('TIMEOUT', 'A consulta excedeu o tempo limite.');
      }
      throw new GatewayError('FONTE_INDISPONIVEL', 'A fonte de saldo está indisponível.');
    } finally {
      this.registro.push({ metodo: 'GET', caminho, status, duracaoMs: Date.now() - inicio });
    }
  }

  /** Traduz por status HTTP e campo `erro`; nunca por texto de mensagem. */
  private interpretar(numero: string, status: number, corpo: unknown): number {
    const objeto = typeof corpo === 'object' && corpo !== null ? (corpo as Record<string, unknown>) : null;
    if (status === 200) {
      if (!objeto || objeto.numero !== numero || typeof objeto.saldo !== 'number') {
        throw new GatewayError('FONTE_INDISPONIVEL', 'A fonte de saldo está indisponível.');
      }
      // Conversão de apresentação reais → centavos na borda; as regras monetárias são do domínio bancário.
      const centavos = Math.round(objeto.saldo * 100);
      if (!Number.isSafeInteger(centavos) || centavos < 0) {
        throw new GatewayError('FONTE_INDISPONIVEL', 'A fonte de saldo está indisponível.');
      }
      return centavos;
    }
    if (status === 400 && objeto?.erro === 'CONTA_INVALIDA') {
      throw new GatewayError('DADOS_INVALIDOS', 'Conta inválida.');
    }
    if (status === 404 && objeto?.erro === 'CONTA_NAO_ENCONTRADA') {
      throw new GatewayError('DADOS_INVALIDOS', 'Conta não encontrada.');
    }
    throw new GatewayError('FONTE_INDISPONIVEL', 'A fonte de saldo está indisponível.');
  }
}
