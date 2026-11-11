import {
  criarDeleteSession,
  criarGetHealth,
  criarPostChat,
  criarPostSessions,
  LIMITE_CORPO_BYTES,
  type ChatDeps,
} from '../../src/api/chat/handlers';
import type { RespostaFinal } from '../../src/dominio/contratos';
import { EXEMPLOS_FAKE, FakeModelClient } from '../../src/modelo/FakeModelClient';
import { InfraError, type ModelClient } from '../../src/modelo/ModelClient';
import { assistente, chamar, json, ScriptedModelClient } from '../support/ScriptedModelClient';
import { novoEstado, obter, respostaSaldo, SessionStore, SIMULACAO_30, textoDe, TraceEmMemoria } from '../support/ajuda';

const BASE = 'http://localhost';

/** Corpo de qualquer resposta do chat; os campos dependem da rota e do status. */
interface Corpo {
  status?: string;
  modo?: string;
  backend?: string;
  sessionId?: string;
  traceId?: string;
  outputRaw?: string | null;
  resposta?: RespostaFinal | null;
  chamadasResumo?: { nome: string; status: string }[];
  erro?: { codigo: string; mensagem: string } | null;
}
interface Resultado {
  status: number;
  corpo: Corpo;
}

const lerCorpo = async (r: Response): Promise<Corpo> => {
  const texto = await r.text();
  return texto ? (JSON.parse(texto) as Corpo) : {};
};
const resultado = async (r: Response): Promise<Resultado> => ({ status: r.status, corpo: await lerCorpo(r) });

/** Dependências novas a cada teste: store, trace e cliente próprios; sem estado global e sem porta. */
function montar(modelClient: ModelClient, extras: Partial<ChatDeps> = {}) {
  const sessoes = new SessionStore();
  const traceSink = new TraceEmMemoria();
  const deps: ChatDeps = { modelClient, sessoes, maxRodadas: 4, traceSink, ...extras };
  const chat = criarPostChat(deps);
  const sessions = criarPostSessions(deps);
  const remover = criarDeleteSession(deps);
  const health = criarGetHealth(deps);

  const postChat = (corpo: string | object) =>
    chat(
      new Request(`${BASE}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: typeof corpo === 'string' ? corpo : JSON.stringify(corpo),
      }),
    ).then(resultado);
  const novaSessao = async () => obter((await resultado(await sessions(new Request(`${BASE}/api/sessions`, { method: 'POST' })))).corpo.sessionId);
  const conversar = (sessionId: string, mensagem = 'Qual é o saldo da conta 123456?', versao: string = 'v2') => postChat({ sessionId, mensagem, versao });
  const excluir = (id: string) => remover(new Request(`${BASE}/api/sessions/${id}`, { method: 'DELETE' }), id);

  return { deps, sessoes, traceSink, health, sessions, postChat, novaSessao, conversar, excluir };
}

const pedirDestino = { acao: 'pedir_dados', mensagem: 'Informe o destino.', dados: { campos: ['destinoId'] } };

describe('rotas de sessão e saúde', () => {
  test('GET /api/health informa o modo e o backend, sem chave nem configuração sensível', async () => {
    const { health } = montar(new ScriptedModelClient([]));
    const r = await resultado(await health(new Request(`${BASE}/api/health`)));
    expect(r.status).toBe(200);
    expect(r.corpo).toEqual({ status: 'ok', modo: 'fake', backend: 'memoria' });
    expect(JSON.stringify(r.corpo)).not.toMatch(/key|chave|AZURE|deployment/i);
  });

  test('POST /api/sessions cria sessão nova com id distinto a cada chamada', async () => {
    const { sessions } = montar(new ScriptedModelClient([]));
    const a = await resultado(await sessions(new Request(`${BASE}/api/sessions`, { method: 'POST' })));
    const b = await resultado(await sessions(new Request(`${BASE}/api/sessions`, { method: 'POST' })));
    expect(a.status).toBe(201);
    expect(typeof a.corpo.sessionId).toBe('string');
    expect(a.corpo.sessionId).not.toBe(b.corpo.sessionId);
  });

  test('DELETE é idempotente (204 existente e ausente) e a sessão excluída passa a dar 404', async () => {
    const t = montar(new ScriptedModelClient([]));
    const id = await t.novaSessao();
    expect((await t.excluir(id)).status).toBe(204);
    expect((await t.excluir(id)).status).toBe(204);
    expect((await t.excluir('inexistente')).status).toBe(204);
    expect((await t.conversar(id)).status).toBe(404);
  });
});

describe('entrada HTTP inválida não chama o modelo', () => {
  test('sessionId inexistente retorna 404 SESSAO_INEXISTENTE', async () => {
    const modelo = new ScriptedModelClient([]);
    const t = montar(modelo);
    const r = await t.conversar('nao-existe');
    expect(r.status).toBe(404);
    expect(r.corpo.erro?.codigo).toBe('SESSAO_INEXISTENTE');
    expect(modelo.requisicoes).toHaveLength(0);
  });

  test.each<[string, string, string]>([
    ['JSON malformado', '{"mensagem":', 'JSON_INVALIDO'],
    ['array no lugar do objeto', '[]', 'CORPO_INVALIDO'],
    ['null', 'null', 'CORPO_INVALIDO'],
    ['número', '42', 'CORPO_INVALIDO'],
    ['corpo vazio', '', 'JSON_INVALIDO'],
  ])('%s retorna 400 %s', async (_nome, corpo, codigo) => {
    const modelo = new ScriptedModelClient([]);
    const r = await montar(modelo).postChat(corpo);
    expect(r.status).toBe(400);
    expect(r.corpo.erro?.codigo).toBe(codigo);
    expect(modelo.requisicoes).toHaveLength(0);
  });

  test.each<[string, Record<string, unknown>]>([
    ['mensagem vazia', { mensagem: '' }],
    ['mensagem só com espaços', { mensagem: '   ' }],
    ['mensagem com 2001 caracteres', { mensagem: 'a'.repeat(2001) }],
    ['mensagem que não é string', { mensagem: 123 }],
    ['versão inválida', { versao: 'v3' }],
    ['versão ausente', { versao: undefined }],
    ['sessionId ausente', { sessionId: undefined }],
  ])('%s retorna 400 REQUISICAO_INVALIDA', async (_nome, alteracao) => {
    const modelo = new ScriptedModelClient([]);
    const t = montar(modelo);
    const sessionId = await t.novaSessao();
    const r = await t.postChat({ sessionId, mensagem: 'Qual é o saldo?', versao: 'v2', ...alteracao });
    expect(r.status).toBe(400);
    expect(r.corpo.erro?.codigo).toBe('REQUISICAO_INVALIDA');
    expect(modelo.requisicoes).toHaveLength(0);
  });

  test('mensagem com exatamente 2000 caracteres é aceita', async () => {
    const t = montar(new ScriptedModelClient([assistente(json(pedirDestino))]));
    const r = await t.conversar(await t.novaSessao(), 'a'.repeat(2000));
    expect(r.status).toBe(200);
  });

  test.each<[string, unknown]>([
    ['esperado', { acao: 'informar_saldo' }],
    ['saldosCentavos', { 123456: 999999999 }],
    ['usuarioId', 'outro-usuario'],
    ['contasAutorizadas', ['999999']],
  ])('campo %s enviado à rota é rejeitado (cliente não define estado nem oráculo)', async (campo, valor) => {
    const modelo = new ScriptedModelClient([]);
    const t = montar(modelo);
    const sessionId = await t.novaSessao();
    const r = await t.postChat({ sessionId, mensagem: 'Qual é o saldo?', versao: 'v2', [campo]: valor });
    expect(r.status).toBe(400);
    expect(modelo.requisicoes).toHaveLength(0);
  });

  test('payload acima de 16 KB retorna 413 pela leitura real do corpo e não chama o modelo', async () => {
    const modelo = new ScriptedModelClient([]);
    const t = montar(modelo);
    const sessionId = await t.novaSessao();
    const r = await t.postChat({ sessionId, mensagem: 'a'.repeat(20 * 1024), versao: 'v2' });
    expect(r.status).toBe(413);
    expect(r.corpo.erro?.codigo).toBe('PAYLOAD_GRANDE');
    expect(modelo.requisicoes).toHaveLength(0);
  });

  test('Content-Length declarado acima do limite retorna 413 antes de ler o corpo', async () => {
    const modelo = new ScriptedModelClient([]);
    const t = montar(modelo);
    const resposta = await criarPostChat(t.deps)(
      new Request(`${BASE}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'content-length': String(LIMITE_CORPO_BYTES + 1) },
        body: '{}',
      }),
    );
    expect(resposta.status).toBe(413);
    expect(modelo.requisicoes).toHaveLength(0);
  });
});

describe('envelope e status HTTP de saída', () => {
  test('ok: 200, envelope exato, erro null e resumo de chamadas sem argumentos nem resultados', async () => {
    const modelo = new ScriptedModelClient([
      chamar('c1', 'consultarSaldo', { contaId: '123456' }),
      assistente(json(respostaSaldo('123456', 10000))),
    ]);
    const t = montar(modelo);

    const r = await t.conversar(await t.novaSessao());

    expect(r.status).toBe(200);
    expect(Object.keys(r.corpo).sort()).toEqual(['backend', 'chamadasResumo', 'erro', 'modo', 'outputRaw', 'resposta', 'status', 'traceId']);
    expect(r.corpo).toMatchObject({ status: 'ok', modo: 'fake', erro: null, resposta: respostaSaldo('123456', 10000) });
    expect(r.corpo.chamadasResumo).toEqual([{ nome: 'consultarSaldo', status: 'executed' }]);
    expect(JSON.stringify(r.corpo.chamadasResumo)).not.toMatch(/123456|saldoCentavos/);
  });

  test('invalid_output: 200 com o texto bruto preservado e erro sanitizado (200 não é aprovação)', async () => {
    const bruto = '```json\n{"acao":"recusar"}\n```';
    const t = montar(new ScriptedModelClient([assistente(bruto)]));
    const r = await t.conversar(await t.novaSessao());
    expect(r.status).toBe(200);
    expect(r.corpo).toMatchObject({ status: 'invalid_output', outputRaw: bruto, resposta: null });
    expect(r.corpo.erro?.codigo).toBe('SAIDA_INVALIDA');
  });

  test('infra_error: 502 com erro {codigo, mensagem}', async () => {
    const t = montar(new ScriptedModelClient([new InfraError('AZURE_AUTENTICACAO', 'O endpoint recusou a autenticação.')]));
    const r = await t.conversar(await t.novaSessao());
    expect(r.status).toBe(502);
    expect(r.corpo).toMatchObject({ status: 'infra_error', outputRaw: null, resposta: null, erro: { codigo: 'AZURE_AUTENTICACAO' } });
  });

  test('runtime_error: 500 ao esgotar as rodadas, sem stack trace', async () => {
    const modelo = new ScriptedModelClient([chamar('c', 'consultarSaldo', { contaId: '123456' })], { repetirUltimo: true });
    const t = montar(modelo);
    const r = await t.conversar(await t.novaSessao());
    expect(r.status).toBe(500);
    expect(r.corpo.erro?.codigo).toBe('LIMITE_RODADAS');
    expect(JSON.stringify(r.corpo)).not.toMatch(/\bat .*\.(js|ts)/);
  });

  test('exceção inesperada do cliente não vaza o texto original', async () => {
    const t = montar(new ScriptedModelClient([new Error('detalhe interno sk-SEGREDO-SINTETICO')]));
    const r = await t.conversar(await t.novaSessao());
    expect(r.status).toBe(500);
    expect(JSON.stringify(r.corpo)).not.toContain('SEGREDO');
  });

  test('falha do próprio handler vira 500 ERRO_INTERNO genérico', async () => {
    const t = montar(new ScriptedModelClient([]), {
      criarGateway: () => {
        throw new Error('quebra interna com detalhes');
      },
    });
    const r = await t.conversar(await t.novaSessao());
    expect(r.status).toBe(500);
    expect(r.corpo.erro).toEqual({ codigo: 'ERRO_INTERNO', mensagem: 'Erro interno.' });
  });

  test('cada resposta gera exatamente um trace com o mesmo traceId', async () => {
    const t = montar(new ScriptedModelClient([assistente(json(pedirDestino))]));
    const r = await t.conversar(await t.novaSessao());
    expect(t.traceSink.traces).toHaveLength(1);
    expect(t.traceSink.traces[0]?.traceId).toBe(r.corpo.traceId);
  });
});

describe('histórico e isolamento entre sessões', () => {
  test('o destino informado no 2º turno chega ao modelo junto com o 1º turno', async () => {
    const modelo = new ScriptedModelClient([assistente(json(pedirDestino)), assistente(json(pedirDestino))]);
    const t = montar(modelo);
    const id = await t.novaSessao();

    await t.conversar(id, 'Simule R$ 30,00 da conta 123456.');
    await t.conversar(id, 'O destino é 654321.');

    const segunda = obter(modelo.requisicoes[1]).mensagens;
    const texto = textoDe(segunda);
    expect(texto).toContain('Simule R$ 30,00 da conta 123456.');
    expect(texto).toContain('Informe o destino.');
    expect(segunda.at(-1)?.content).toBe('O destino é 654321.');
  });

  test('sessões são isoladas: a segunda não vê o histórico da primeira', async () => {
    const modelo = new ScriptedModelClient([assistente(json(pedirDestino)), assistente(json(pedirDestino))]);
    const t = montar(modelo);

    await t.conversar(await t.novaSessao(), 'Mensagem exclusiva da sessão A.');
    await t.conversar(await t.novaSessao(), 'Mensagem da sessão B.');

    expect(textoDe(obter(modelo.requisicoes[1]).mensagens)).not.toContain('sessão A');
  });

  test('turno com infra_error não entra no histórico', async () => {
    const modelo = new ScriptedModelClient([new InfraError('AZURE_REDE', 'Sem conexão.'), assistente(json(pedirDestino))]);
    const t = montar(modelo);
    const id = await t.novaSessao();

    await t.conversar(id, 'Primeira tentativa que falhou.');
    await t.conversar(id, 'Segunda tentativa.');

    expect(textoDe(obter(modelo.requisicoes[1]).mensagens)).not.toContain('Primeira tentativa');
  });

  test('o histórico é limitado aos 10 últimos turnos completos', async () => {
    const modelo = new ScriptedModelClient(Array.from({ length: 12 }, () => assistente(json(pedirDestino))));
    const t = montar(modelo);
    const id = await t.novaSessao();

    for (let i = 1; i <= 12; i++) await t.conversar(id, `turno-${i}`);

    const texto = textoDe(obter(modelo.requisicoes[11]).mensagens);
    // Na 12ª requisição seguem os 10 turnos anteriores (2 a 11) e a mensagem atual (12); só o 1º sai.
    expect(texto).not.toMatch(/^turno-1$/m);
    expect(texto).toMatch(/^turno-2$/m);
    expect(texto).toMatch(/^turno-11$/m);
    expect(texto).toMatch(/^turno-12$/m);
  });

  test('a versão escolhida muda só o texto da instrução, não as ferramentas anunciadas', async () => {
    const modelo = new ScriptedModelClient([assistente(json(pedirDestino)), assistente(json(pedirDestino))]);
    const t = montar(modelo);
    const id = await t.novaSessao();

    await t.conversar(id, 'um', 'v1');
    await t.conversar(id, 'dois', 'v2');

    expect(obter(obter(modelo.requisicoes[0]).mensagens[0]?.content)).toContain('INSTRUÇÕES DA VERSÃO V1');
    expect(obter(obter(modelo.requisicoes[1]).mensagens[0]?.content)).toContain('INSTRUÇÕES DA VERSÃO V2');
    expect(obter(modelo.requisicoes[0]).ferramentas).toEqual(obter(modelo.requisicoes[1]).ferramentas);
  });
});

describe('modo fake roteirizado pelo núcleo real', () => {
  test('os três exemplos passam pelo loop; simular não muda os saldos e consultar depois preserva 10000/2000', async () => {
    const t = montar(new FakeModelClient());
    const id = await t.novaSessao();

    const consulta = await t.conversar(id, EXEMPLOS_FAKE[0]);
    expect(consulta.corpo).toMatchObject({ status: 'ok', modo: 'fake', resposta: { acao: 'informar_saldo', dados: { contaId: '123456', saldoCentavos: 10000 } } });

    const simulacao = await t.conversar(id, EXEMPLOS_FAKE[1]);
    expect(simulacao.corpo.resposta?.acao).toBe('simular');
    expect(simulacao.corpo.resposta?.dados).toEqual(SIMULACAO_30);

    const pedido = await t.conversar(id, EXEMPLOS_FAKE[2]);
    expect(pedido.corpo.resposta).toMatchObject({ acao: 'pedir_dados', dados: { campos: ['destinoId'] } });
    expect(pedido.corpo.chamadasResumo).toEqual([]);

    const depois = await t.conversar(id, EXEMPLOS_FAKE[0]);
    expect(depois.corpo.resposta?.dados.saldoCentavos).toBe(10000);
    const trace = obter(t.traceSink.traces[1]);
    expect(trace.saldosAntes).toEqual(trace.saldosDepois);
  });

  test('entrada fora dos exemplos retorna recusa identificada DADOS_INVALIDOS, sem classificar linguagem natural', async () => {
    const t = montar(new FakeModelClient());
    const r = await t.conversar(await t.novaSessao(), 'Qual o saldo da minha conta?');
    expect(r.corpo.resposta).toMatchObject({ acao: 'recusar', dados: { codigo: 'DADOS_INVALIDOS' } });
    expect(r.corpo.resposta?.mensagem).toContain('Modo roteirizado');
  });
});

describe('estado por sessão', () => {
  test('o estado é criado pelo servidor: novoEstado injeta saldos próprios por sessão', async () => {
    const modelo = new ScriptedModelClient([
      chamar('c1', 'consultarSaldo', { contaId: '123456' }),
      assistente(json(respostaSaldo('123456', 4242))),
    ]);
    const t = montar(modelo, { novoEstado: () => novoEstado({ saldosCentavos: { '123456': 4242, '654321': 1 } }) });
    await t.conversar(await t.novaSessao());
    expect(t.traceSink.traces[0]?.chamadas[0]?.resultado).toMatchObject({ ok: true, saldoCentavos: 4242 });
  });
});
