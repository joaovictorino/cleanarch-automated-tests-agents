import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { ContasHttpGateway } from '../../src/banco/ContasHttpGateway';
import { GatewayError } from '../../src/banco/ContasGateway';
import { executarTurno } from '../../src/assistente';
import { consultarSaldo, simularTransferencia } from '../../src/dominio/ferramentas';
import { assistente, chamar, json, ScriptedModelClient } from '../support/ScriptedModelClient';
import { novoEstado, parametrosTurno, respostaSimulacao, SIMULACAO_30 } from '../support/ajuda';

type Rota = { travar: true } | { status: number; corpo: unknown };

/** Aplicação bancária de mentira: só o contrato HTTP das contas, em porta efêmera. */
let servidor: http.Server;
let base: string;
let requisicoes: { metodo: string | undefined; url: string | undefined }[] = [];
let rotas: Record<string, Rota> = {};

beforeAll(async () => {
  servidor = http.createServer((req, res) => {
    requisicoes.push({ metodo: req.method, url: req.url });
    const rota = rotas[req.url ?? ''];
    if (!rota) return void res.writeHead(404, { 'content-type': 'application/json' }).end(json({ erro: 'CONTA_NAO_ENCONTRADA' }));
    if ('travar' in rota) return; // nunca responde: exercita o timeout
    res.writeHead(rota.status, { 'content-type': 'application/json' }).end(typeof rota.corpo === 'string' ? rota.corpo : json(rota.corpo));
  });
  await new Promise<void>((ok) => servidor.listen(0, '127.0.0.1', ok));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});

afterAll(async () => {
  servidor.closeAllConnections();
  await new Promise<void>((ok) => servidor.close(() => ok()));
});

beforeEach(() => {
  requisicoes = [];
  rotas = {
    '/api/contas/123456': { status: 200, corpo: { numero: '123456', saldo: 100 } },
    '/api/contas/654321': { status: 200, corpo: { numero: '654321', saldo: 20.5 } },
  };
});

const gateway = (timeoutMs = 2000, url = base) => new ContasHttpGateway(url, timeoutMs);

describe('ContasHttpGateway', () => {
  test('200 {numero, saldo} em reais vira centavos inteiros e registra só GET/caminho/status', async () => {
    const g = gateway();
    expect(await g.obterSaldoCentavos('123456')).toBe(10000);
    expect(await g.obterSaldoCentavos('654321')).toBe(2050);
    expect(g.chamadas.map((c) => [c.metodo, c.caminho, c.status])).toEqual([
      ['GET', '/api/contas/123456', 200],
      ['GET', '/api/contas/654321', 200],
    ]);
    expect(JSON.stringify(g.chamadas)).not.toContain(base);
  });

  test.each<[string, Rota, string]>([
    ['400 CONTA_INVALIDA', { status: 400, corpo: { erro: 'CONTA_INVALIDA' } }, 'DADOS_INVALIDOS'],
    ['404 CONTA_NAO_ENCONTRADA', { status: 404, corpo: { erro: 'CONTA_NAO_ENCONTRADA' } }, 'DADOS_INVALIDOS'],
    ['500 ERRO_INTERNO', { status: 500, corpo: { erro: 'ERRO_INTERNO' } }, 'FONTE_INDISPONIVEL'],
    ['404 com código desconhecido', { status: 404, corpo: { erro: 'OUTRA' } }, 'FONTE_INDISPONIVEL'],
    ['200 com corpo fora do contrato', { status: 200, corpo: { saldo: 'cem' } }, 'FONTE_INDISPONIVEL'],
    ['200 com número diferente do pedido', { status: 200, corpo: { numero: '999999', saldo: 1 } }, 'FONTE_INDISPONIVEL'],
    ['200 com corpo não JSON', { status: 200, corpo: '<html>' }, 'FONTE_INDISPONIVEL'],
    ['200 com saldo negativo', { status: 200, corpo: { numero: '123456', saldo: -1 } }, 'FONTE_INDISPONIVEL'],
  ])('%s vira %s', async (_nome, rota, codigo) => {
    rotas['/api/contas/123456'] = rota;
    await expect(gateway().obterSaldoCentavos('123456')).rejects.toMatchObject({ name: 'GatewayError', codigo });
  });

  test('resposta lenta vira TIMEOUT', async () => {
    rotas['/api/contas/123456'] = { travar: true };
    await expect(gateway(80).obterSaldoCentavos('123456')).rejects.toMatchObject({ codigo: 'TIMEOUT' });
  });

  test('conexão recusada vira FONTE_INDISPONIVEL e registra a chamada sem status', async () => {
    const mudo = http.createServer();
    await new Promise<void>((ok) => mudo.listen(0, '127.0.0.1', ok));
    const porta = (mudo.address() as AddressInfo).port;
    await new Promise<void>((ok) => mudo.close(() => ok()));

    const g = gateway(1000, `http://127.0.0.1:${porta}`);
    await expect(g.obterSaldoCentavos('123456')).rejects.toMatchObject({ codigo: 'FONTE_INDISPONIVEL' });
    expect(g.chamadas[0]).toMatchObject({ metodo: 'GET', caminho: '/api/contas/123456', status: null });
  });

  test('mensagem, URL e corpo da API bancária não aparecem no erro', async () => {
    rotas['/api/contas/123456'] = { status: 500, corpo: { erro: 'ERRO_INTERNO', stack: 'at segredo.ts:1' } };
    const erro = await gateway().obterSaldoCentavos('123456').catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(GatewayError);
    const texto = `${(erro as GatewayError).message} ${JSON.stringify(erro)}`;
    expect(texto).not.toMatch(/segredo|127\.0\.0\.1|ERRO_INTERNO/);
  });

  test('identificador com caracteres especiais é codificado no caminho', async () => {
    const g = gateway();
    await g.obterSaldoCentavos('../transferencias').catch(() => undefined);
    expect(g.chamadas[0]?.caminho).toBe('/api/contas/..%2Ftransferencias');
  });
});

describe('ferramentas com o gateway HTTP', () => {
  test('simularTransferencia faz dois GET, nenhum POST e calcula a projeção no chat', async () => {
    rotas['/api/contas/654321'] = { status: 200, corpo: { numero: '654321', saldo: 20 } };
    const estado = novoEstado({ saldosCentavos: {} });

    const r = await simularTransferencia(estado, gateway(), { origemId: '123456', destinoId: '654321', valorCentavos: 3000 });

    expect(r).toMatchObject({
      ok: true,
      saldoOrigemAtualCentavos: 10000,
      saldoDestinoAtualCentavos: 2000,
      saldoOrigemPrevistoCentavos: 7000,
      saldoDestinoPrevistoCentavos: 5000,
    });
    expect(requisicoes).toEqual([
      { metodo: 'GET', url: '/api/contas/123456' },
      { metodo: 'GET', url: '/api/contas/654321' },
    ]);
  });

  test('conta não autorizada não gera nenhuma requisição à aplicação bancária', async () => {
    const estado = novoEstado({ saldosCentavos: {} });
    const r1 = await consultarSaldo(estado, gateway(), { contaId: '999999' });
    const r2 = await simularTransferencia(estado, gateway(), { origemId: '123456', destinoId: '999999', valorCentavos: 100 });
    expect(r1).toMatchObject({ ok: false, codigo: 'NAO_AUTORIZADO' });
    expect(r2).toMatchObject({ ok: false, codigo: 'NAO_AUTORIZADO' });
    expect(requisicoes).toHaveLength(0);
  });

  test.each<[string, Rota, string]>([
    ['conta inexistente na API (404)', { status: 404, corpo: { erro: 'CONTA_NAO_ENCONTRADA' } }, 'DADOS_INVALIDOS'],
    ['API com erro 500', { status: 500, corpo: { erro: 'ERRO_INTERNO' } }, 'FONTE_INDISPONIVEL'],
  ])('consultarSaldo com %s retorna %s', async (_nome, rota, codigo) => {
    rotas['/api/contas/123456'] = rota;
    const r = await consultarSaldo(novoEstado({ saldosCentavos: {} }), gateway(), { contaId: '123456' });
    expect(r).toMatchObject({ ok: false, codigo });
  });

  test('pelo núcleo: o turno só usa GET e o trace registra as chamadas bancárias', async () => {
    const modelo = new ScriptedModelClient([
      chamar('s1', 'simularTransferencia', { origemId: '123456', destinoId: '654321', valorCentavos: 3000 }),
      assistente(json(respostaSimulacao({ ...SIMULACAO_30, saldoDestinoAtualCentavos: 2050, saldoDestinoPrevistoCentavos: 5050 }))),
    ]);
    const estado = novoEstado({ saldosCentavos: {} });

    const r = await executarTurno(parametrosTurno(modelo, { estado, gateway: gateway() }));

    expect(r.status).toBe('ok');
    expect(r.backend).toBe('http');
    expect(r.trace.backend).toBe('http');
    expect(r.trace.chamadasBanco.map((c) => `${c.metodo} ${c.caminho} ${c.status}`)).toEqual([
      'GET /api/contas/123456 200',
      'GET /api/contas/654321 200',
    ]);
    expect(requisicoes.every((q) => q.metodo === 'GET')).toBe(true);
  });
});
