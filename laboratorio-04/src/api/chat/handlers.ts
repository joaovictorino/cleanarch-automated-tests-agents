import { executarTurno } from '../../assistente';
import type { ContasGateway } from '../../banco/ContasGateway';
import { estadoInicial, type EstadoSessao, type ErroSanitizado, type RespostaFinal, type StatusTurno } from '../../dominio/contratos';
import type { ModelClient } from '../../modelo/ModelClient';
import { carregarPrompt, VERSOES, type VersaoPrompt } from '../../prompts';
import type { SessionStore } from '../../sessoes';
import type { TraceSink } from '../../trace';

/**
 * Factories HTTP do chat. Só validam o transporte (JSON, objeto, campos, typeof, tamanho),
 * delegam ao núcleo e traduzem o resultado. Não importam next/*: usam Request/Response globais.
 */
export interface ChatDeps {
  modelClient: ModelClient;
  sessoes: SessionStore;
  maxRodadas: number;
  traceSink?: TraceSink;
  /** Estado inicial de cada sessão; padrão: fixture em memória. */
  novoEstado?: () => EstadoSessao;
  /** Gateway de contas por turno; padrão: fixture em memória sobre o estado da sessão. */
  criarGateway?: (estado: EstadoSessao) => ContasGateway;
}

export interface ErroHttp {
  codigo: string;
  mensagem: string;
}

export interface EnvelopeChat {
  traceId: string;
  modo: 'azure' | 'fake';
  backend: 'http' | 'memoria';
  status: StatusTurno;
  outputRaw: string | null;
  resposta: RespostaFinal | null;
  chamadasResumo: { nome: string; status: string }[];
  erro: ErroSanitizado | null;
}

export const LIMITE_CORPO_BYTES = 16 * 1024;
const CAMPOS_CHAT = ['sessionId', 'mensagem', 'versao'];
const HTTP_POR_STATUS: Record<StatusTurno, number> = { ok: 200, invalid_output: 200, infra_error: 502, runtime_error: 500 };

function json(corpo: unknown, status: number): Response {
  return Response.json(corpo, { status });
}

function erroHttp(status: number, codigo: string, mensagem: string): Response {
  return json({ erro: { codigo, mensagem } satisfies ErroHttp }, status);
}

type CorpoLido = { ok: true; texto: string } | { ok: false; resposta: Response };

/** O Next.js não limita o corpo de Route Handlers: lê com limite de bytes (cabeçalho e leitura real). */
async function lerCorpoLimitado(request: Request): Promise<CorpoLido> {
  const excedeu = (): CorpoLido => ({ ok: false, resposta: erroHttp(413, 'PAYLOAD_GRANDE', 'O corpo excede 16 KB.') });
  const declarado = Number(request.headers.get('content-length'));
  if (Number.isFinite(declarado) && declarado > LIMITE_CORPO_BYTES) return excedeu();
  if (!request.body) return { ok: true, texto: '' };

  const leitor = request.body.getReader();
  const pedacos: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.byteLength;
    if (total > LIMITE_CORPO_BYTES) {
      await leitor.cancel();
      return excedeu();
    }
    pedacos.push(value);
  }
  return { ok: true, texto: Buffer.concat(pedacos).toString('utf8') };
}

export function criarGetHealth(deps: ChatDeps): (request: Request) => Promise<Response> {
  return async () => {
    const backend = deps.criarGateway ? deps.criarGateway((deps.novoEstado ?? estadoInicial)()).backend : 'memoria';
    return json({ status: 'ok', modo: deps.modelClient.modo, backend }, 200);
  };
}

export function criarPostSessions(deps: ChatDeps): (request: Request) => Promise<Response> {
  return async () => json({ sessionId: deps.sessoes.criar(deps.novoEstado?.()).id }, 201);
}

export function criarDeleteSession(deps: ChatDeps): (request: Request, id: string) => Promise<Response> {
  return async (_request, id) => {
    deps.sessoes.descartar(id);
    return new Response(null, { status: 204 });
  };
}

export function criarPostChat(deps: ChatDeps): (request: Request) => Promise<Response> {
  return async (request) => {
    try {
      const lido = await lerCorpoLimitado(request);
      if (!lido.ok) return lido.resposta;

      let corpo: unknown;
      try {
        corpo = JSON.parse(lido.texto);
      } catch {
        return erroHttp(400, 'JSON_INVALIDO', 'JSON malformado.');
      }
      if (typeof corpo !== 'object' || corpo === null || Array.isArray(corpo)) {
        return erroHttp(400, 'CORPO_INVALIDO', 'Envie um objeto JSON.');
      }

      const campos = corpo as Record<string, unknown>;
      const extras = Object.keys(campos).filter((c) => !CAMPOS_CHAT.includes(c));
      const { sessionId, mensagem, versao } = campos;
      const mensagemLimpa = typeof mensagem === 'string' ? mensagem.trim() : '';
      if (
        extras.length > 0 ||
        typeof sessionId !== 'string' ||
        sessionId === '' ||
        mensagemLimpa.length < 1 ||
        mensagemLimpa.length > 2000 ||
        typeof versao !== 'string' ||
        !(VERSOES as readonly string[]).includes(versao)
      ) {
        return erroHttp(400, 'REQUISICAO_INVALIDA', 'Use sessionId, mensagem (1–2000 caracteres) e versao "v1" ou "v2".');
      }

      const sessao = deps.sessoes.obter(sessionId);
      if (!sessao) return erroHttp(404, 'SESSAO_INEXISTENTE', 'Sessão não encontrada.');

      const resultado = await executarTurno({
        mensagem: mensagemLimpa,
        historico: sessao.historico,
        estado: sessao.estado,
        gateway: deps.criarGateway?.(sessao.estado),
        prompt: carregarPrompt(versao as VersaoPrompt),
        modelClient: deps.modelClient,
        maxRodadas: deps.maxRodadas,
        traceSink: deps.traceSink,
      });
      if (resultado.status === 'ok' || resultado.status === 'invalid_output') {
        deps.sessoes.registrarTurno(sessao, resultado.mensagensDoTurno);
      }
      const envelope: EnvelopeChat = {
        traceId: resultado.traceId,
        modo: resultado.modo,
        backend: resultado.backend,
        status: resultado.status,
        outputRaw: resultado.outputRaw,
        resposta: resultado.resposta,
        chamadasResumo: resultado.chamadas.map((c) => ({ nome: c.nome, status: c.status })),
        erro: resultado.erro,
      };
      return json(envelope, HTTP_POR_STATUS[resultado.status]);
    } catch {
      // Nunca expõe stack nem mensagens técnicas.
      return erroHttp(500, 'ERRO_INTERNO', 'Erro interno.');
    }
  };
}
