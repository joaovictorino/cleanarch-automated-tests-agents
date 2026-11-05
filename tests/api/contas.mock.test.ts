import { criarGetContaPorId, criarGetContas, criarPostContas } from '../../src/api/contas/handlers';
import { ErroNegocio } from '../../src/domain/ErroNegocio';

function criarOperacoesMock() {
  return { criar: jest.fn(), listar: jest.fn(), consultar: jest.fn() };
}

function postJson(corpo: string): Request {
  return new Request('http://localhost/api/contas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: corpo,
  });
}


describe('POST /api/contas — contrato HTTP com mock', () => {
  test('CMOCK-01: criar conta devolve 201 e Location', async () => {
    // Arrange
    const criar = jest.fn().mockResolvedValue({ numero: '123456', saldo: 1000 });
    const operacoes = {
      criar,
      listar: jest.fn(),
      consultar: jest.fn(),
    };
    const POST = criarPostContas(operacoes);
    const request = new Request('http://localhost/api/contas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numero: '123456', saldoInicial: 1000 }),
    });

    // Act
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ numero: '123456', saldo: 1000 });
    expect(response.headers.get('Location')).toBe('/api/contas/123456');
    expect(criar).toHaveBeenCalledTimes(1);
    expect(criar).toHaveBeenCalledWith({ numero: '123456', saldoInicial: 1000 });
  });

  test.each([
    ['número numérico', { numero: 123456, saldoInicial: 10 }, 'CONTA_INVALIDA'],
    ['número ausente', { saldoInicial: 10 }, 'CONTA_INVALIDA'],
    ['saldo como string', { numero: '123456', saldoInicial: '10' }, 'SALDO_INVALIDO'],
    ['saldo ausente', { numero: '123456' }, 'SALDO_INVALIDO'],
    ['saldo null', { numero: '123456', saldoInicial: null }, 'SALDO_INVALIDO'],
    ['número e saldo com tipos inválidos (precedência)', { numero: 12, saldoInicial: 'x' }, 'CONTA_INVALIDA'],
  ])('CMOCK-02: %s (tipo) devolve 400 sem chamar criar', async (_nome, corpo, codigo) => {
    const operacoes = criarOperacoesMock();
    const POST = criarPostContas(operacoes);

    const response = await POST(postJson(JSON.stringify(corpo)));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ erro: codigo });
    expect(operacoes.criar).not.toHaveBeenCalled();
  });

  test('CMOCK-02b: número com formato inválido chega como ErroNegocio e vira 400', async () => {
    const operacoes = criarOperacoesMock();
    operacoes.criar.mockRejectedValue(new ErroNegocio('CONTA_INVALIDA', 'mensagem de teste'));
    const POST = criarPostContas(operacoes);

    const response = await POST(postJson(JSON.stringify({ numero: '12345', saldoInicial: 10 })));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ erro: 'CONTA_INVALIDA' });
    expect(operacoes.criar).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['JSON quebrado', '{'],
    ['null', 'null'],
    ['array', '[]'],
    ['string JSON', '"abc"'],
  ])('CMOCK-03: corpo %s devolve 400 REQUISICAO_INVALIDA', async (_nome, corpo) => {
    const operacoes = criarOperacoesMock();
    const POST = criarPostContas(operacoes);

    const response = await POST(postJson(corpo));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ erro: 'REQUISICAO_INVALIDA' });
    expect(operacoes.criar).not.toHaveBeenCalled();
  });

  test('CMOCK-04: CONTA_JA_EXISTE vira 409 sem vazar mensagem', async () => {
    const operacoes = criarOperacoesMock();
    operacoes.criar.mockRejectedValue(new ErroNegocio('CONTA_JA_EXISTE', 'mensagem de teste'));
    const POST = criarPostContas(operacoes);

    const response = await POST(postJson(JSON.stringify({ numero: '123456', saldoInicial: 1 })));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ erro: 'CONTA_JA_EXISTE' });
  });

  test('CMOCK-04b: SALDO_INVALIDO do domínio vira 400', async () => {
    const operacoes = criarOperacoesMock();
    operacoes.criar.mockRejectedValue(new ErroNegocio('SALDO_INVALIDO', 'mensagem de teste'));
    const POST = criarPostContas(operacoes);

    const response = await POST(postJson(JSON.stringify({ numero: '123456', saldoInicial: -1 })));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ erro: 'SALDO_INVALIDO' });
  });

  test('CMOCK-05: erro inesperado vira 500 ERRO_INTERNO sem detalhes', async () => {
    const operacoes = criarOperacoesMock();
    operacoes.criar.mockRejectedValue(new Error('senha do banco: segredo'));
    const POST = criarPostContas(operacoes);

    const response = await POST(postJson(JSON.stringify({ numero: '123456', saldoInicial: 1 })));

    expect(response.status).toBe(500);
    const texto = await response.text();
    expect(JSON.parse(texto)).toEqual({ erro: 'ERRO_INTERNO' });
    expect(texto).not.toContain('segredo');
  });
});

describe('GET /api/contas — contrato HTTP com mock', () => {
  test('CMOCK-06: lista DTOs ordenados pelo número da conta', async () => {
    const operacoes = criarOperacoesMock();
    const original = [
      { numero: '654321', saldo: 200 },
      { numero: '001234', saldo: 0 },
    ];
    operacoes.listar.mockResolvedValue(original);
    const GET = criarGetContas(operacoes);

    const response = await GET(new Request('http://localhost/api/contas?ordem=desc'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      contas: [
        { numero: '001234', saldo: 0 },
        { numero: '654321', saldo: 200 },
      ],
    });
    expect(operacoes.listar).toHaveBeenCalledTimes(1);
    expect(operacoes.criar).not.toHaveBeenCalled();
    expect(operacoes.consultar).not.toHaveBeenCalled();
    expect(original[0].numero).toBe('654321'); // não muta a entrada
  });

  test('CMOCK-06b: lista expõe somente numero e saldo', async () => {
    const operacoes = criarOperacoesMock();
    operacoes.listar.mockResolvedValue([{ numero: '123456', saldo: 1, extra: 'x' }]);
    const GET = criarGetContas(operacoes);

    const response = await GET(new Request('http://localhost/api/contas'));

    expect(await response.json()).toEqual({ contas: [{ numero: '123456', saldo: 1 }] });
  });

  test('CMOCK-06c: lista vazia devolve {"contas":[]}', async () => {
    const operacoes = criarOperacoesMock();
    operacoes.listar.mockResolvedValue([]);
    const GET = criarGetContas(operacoes);

    const response = await GET(new Request('http://localhost/api/contas'));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('{"contas":[]}');
  });

  test('CMOCK-06d: falha inesperada em listar vira 500 ERRO_INTERNO', async () => {
    const operacoes = criarOperacoesMock();
    operacoes.listar.mockRejectedValue(new Error('detalhe interno'));
    const GET = criarGetContas(operacoes);

    const response = await GET(new Request('http://localhost/api/contas'));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ erro: 'ERRO_INTERNO' });
  });

  test('CMOCK-07: consulta ID válido e retorna uma conta', async () => {
    const operacoes = criarOperacoesMock();
    operacoes.consultar.mockResolvedValue({ numero: '123456', saldo: 1000 });
    const GET = criarGetContaPorId(operacoes);

    const response = await GET(new Request('http://localhost/api/contas/123456'), '123456');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ numero: '123456', saldo: 1000 });
    expect(operacoes.consultar).toHaveBeenCalledTimes(1);
    expect(operacoes.consultar).toHaveBeenCalledWith('123456');
  });

  test('CMOCK-08: ID inválido chega como ErroNegocio e vira 400 CONTA_INVALIDA', async () => {
    const operacoes = criarOperacoesMock();
    operacoes.consultar.mockRejectedValue(new ErroNegocio('CONTA_INVALIDA', 'mensagem de teste'));
    const GET = criarGetContaPorId(operacoes);

    const response = await GET(new Request('http://localhost/api/contas/x'), '12345');

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ erro: 'CONTA_INVALIDA' });
    expect(operacoes.consultar).toHaveBeenCalledWith('12345');
  });

  test('CMOCK-09: ID inexistente devolve 404 CONTA_NAO_ENCONTRADA', async () => {
    const operacoes = criarOperacoesMock();
    operacoes.consultar.mockResolvedValue(undefined);
    const GET = criarGetContaPorId(operacoes);

    const response = await GET(new Request('http://localhost/api/contas/999999'), '999999');

    expect(response.status).toBe(404);
    expect(await response.text()).toBe('{"erro":"CONTA_NAO_ENCONTRADA"}');
  });

  test('CMOCK-09b: falha inesperada em consultar vira 500 ERRO_INTERNO', async () => {
    const operacoes = criarOperacoesMock();
    operacoes.consultar.mockRejectedValue(new Error('detalhe interno'));
    const GET = criarGetContaPorId(operacoes);

    const response = await GET(new Request('http://localhost/api/contas/123456'), '123456');

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ erro: 'ERRO_INTERNO' });
  });
});
