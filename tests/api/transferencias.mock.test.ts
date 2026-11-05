import { criarPostTransferencias } from '../../src/api/transferencias/handler';
import { ErroNegocio } from '../../src/domain/ErroNegocio';

function requisicao(corpo: string): Request {
  return new Request('http://localhost/api/transferencias', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: corpo,
  });
}

const valido = { contaOrigem: '123456', contaDestino: '654321', valor: 300 };

describe('POST /api/transferencias — mock da operação', () => {
  test('MOCK-01: encaminha dados e devolve comprovante HTTP 201', async () => {
    const executar = jest.fn().mockResolvedValue({ comprovante: '123456' });
    const POST = criarPostTransferencias({ executar });

    const resposta = await POST(requisicao(JSON.stringify(valido)));

    expect(resposta.status).toBe(201);
    expect(await resposta.json()).toEqual({ comprovante: '123456' });
    expect(executar).toHaveBeenCalledTimes(1);
    expect(executar).toHaveBeenCalledWith(valido);
  });

  test('MOCK-02: valor zero é traduzido a partir do ErroNegocio do domínio', async () => {
    const executar = jest.fn().mockRejectedValue(new ErroNegocio('VALOR_INVALIDO', 'valor'));
    const POST = criarPostTransferencias({ executar });

    const resposta = await POST(requisicao(JSON.stringify({ ...valido, valor: 0 })));

    expect(resposta.status).toBe(400);
    expect(await resposta.json()).toEqual({ erro: 'VALOR_INVALIDO' });
    expect(executar).toHaveBeenCalledWith({ ...valido, valor: 0 });
  });

  test.each([
    ['conta numérica', { ...valido, contaOrigem: 123456 }],
    ['conta ausente', { contaDestino: '654321', valor: 300 }],
  ])('MOCK-03/API-06: %s (tipo) → 400 CONTA_INVALIDA sem acionar a operação', async (_n, corpo) => {
    const executar = jest.fn();
    const POST = criarPostTransferencias({ executar });

    const resposta = await POST(requisicao(JSON.stringify(corpo)));

    expect(resposta.status).toBe(400);
    expect(await resposta.json()).toEqual({ erro: 'CONTA_INVALIDA' });
    expect(executar).not.toHaveBeenCalled();
  });

  test.each([
    ['conta de origem com cinco dígitos', { ...valido, contaOrigem: '12345' }],
    ['conta de destino com sete dígitos', { ...valido, contaDestino: '1234567' }],
  ])('MOCK-03/API-06: %s (formato) → 400 CONTA_INVALIDA vindo do ErroNegocio', async (_n, corpo) => {
    const executar = jest.fn().mockRejectedValue(new ErroNegocio('CONTA_INVALIDA', 'conta'));
    const POST = criarPostTransferencias({ executar });

    const resposta = await POST(requisicao(JSON.stringify(corpo)));

    expect(resposta.status).toBe(400);
    expect(await resposta.json()).toEqual({ erro: 'CONTA_INVALIDA' });
    expect(executar).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['JSON malformado', '{'],
    ['null', 'null'],
    ['array', '[]'],
    ['string JSON', '"abc"'],
    ['corpo vazio', ''],
  ])('MOCK-03/API-09: %s → 400 REQUISICAO_INVALIDA sem acionar a operação', async (_n, corpo) => {
    const executar = jest.fn();
    const POST = criarPostTransferencias({ executar });

    const resposta = await POST(requisicao(corpo));

    expect(resposta.status).toBe(400);
    expect(await resposta.json()).toEqual({ erro: 'REQUISICAO_INVALIDA' });
    expect(executar).not.toHaveBeenCalled();
  });

  test.each([
    ['zero', 0],
    ['negativo', -1],
    ['três casas decimais', 1.255],
  ])('API-04/05: valor %s → 400 VALOR_INVALIDO vindo do ErroNegocio', async (_n, v) => {
    const executar = jest.fn().mockRejectedValue(new ErroNegocio('VALOR_INVALIDO', 'valor'));
    const POST = criarPostTransferencias({ executar });

    const resposta = await POST(requisicao(JSON.stringify({ ...valido, valor: v })));

    expect(resposta.status).toBe(400);
    expect(await resposta.json()).toEqual({ erro: 'VALOR_INVALIDO' });
    expect(executar).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['string numérica', '300'],
    ['null', null],
    ['omitido', undefined],
    ['booleano', true],
  ])('API-05: valor %s (tipo) → 400 VALOR_INVALIDO sem acionar a operação', async (_n, v) => {
    const executar = jest.fn();
    const POST = criarPostTransferencias({ executar });

    const resposta = await POST(requisicao(JSON.stringify({ ...valido, valor: v })));

    expect(resposta.status).toBe(400);
    expect(await resposta.json()).toEqual({ erro: 'VALOR_INVALIDO' });
    expect(executar).not.toHaveBeenCalled();
  });

  test('API-12b: tipo de conta e de valor inválidos → precedência para CONTA_INVALIDA', async () => {
    const executar = jest.fn();
    const POST = criarPostTransferencias({ executar });

    const resposta = await POST(
      requisicao(JSON.stringify({ contaOrigem: 12345, contaDestino: '654321', valor: 'x' })),
    );

    expect(resposta.status).toBe(400);
    expect(await resposta.json()).toEqual({ erro: 'CONTA_INVALIDA' });
    expect(executar).not.toHaveBeenCalled();
  });

  test('API-10: aceita centavos (0.29) e zeros à esquerda e repassa intactos', async () => {
    const executar = jest.fn().mockResolvedValue({ comprovante: '123456' });
    const POST = criarPostTransferencias({ executar });
    const dados = { contaOrigem: '001234', contaDestino: '654321', valor: 0.29 };

    const resposta = await POST(requisicao(JSON.stringify(dados)));

    expect(resposta.status).toBe(201);
    expect(executar).toHaveBeenCalledWith(dados);
  });

  test('campos adicionais são ignorados e não chegam à operação', async () => {
    const executar = jest.fn().mockResolvedValue({ comprovante: '123456' });
    const POST = criarPostTransferencias({ executar });

    const resposta = await POST(requisicao(JSON.stringify({ ...valido, extra: 'x' })));

    expect(resposta.status).toBe(201);
    expect(executar).toHaveBeenCalledWith(valido);
  });

  test.each([
    ['SALDO_INSUFICIENTE', 422],
    ['MESMA_CONTA', 422],
    ['CONTA_NAO_ENCONTRADA', 404],
  ] as const)('MOCK-04: ErroNegocio %s → HTTP %i sem vazar mensagem', async (codigo, status) => {
    const executar = jest.fn().mockRejectedValue(new ErroNegocio(codigo, 'mensagem-sensivel'));
    const POST = criarPostTransferencias({ executar });

    const resposta = await POST(requisicao(JSON.stringify(valido)));
    const texto = await resposta.text();

    expect(resposta.status).toBe(status);
    expect(JSON.parse(texto)).toEqual({ erro: codigo });
    expect(texto).not.toContain('mensagem-sensivel');
    expect(executar).toHaveBeenCalledTimes(1);
  });

  test('ErroNegocio com código não previsto para o endpoint → 500 ERRO_INTERNO', async () => {
    const executar = jest.fn().mockRejectedValue(new ErroNegocio('CONTA_JA_EXISTE', 'detalhe'));
    const POST = criarPostTransferencias({ executar });

    const resposta = await POST(requisicao(JSON.stringify(valido)));

    expect(resposta.status).toBe(500);
    expect(await resposta.json()).toEqual({ erro: 'ERRO_INTERNO' });
  });

  test.each([
    ['assíncrona', () => Promise.reject(new Error('segredo interno'))],
    [
      'síncrona',
      () => {
        throw new Error('segredo interno');
      },
    ],
  ])('MOCK-05/API-11: falha inesperada %s → 500 ERRO_INTERNO sem vazar mensagem', async (_n, impl) => {
    const executar = jest.fn().mockImplementation(impl);
    const POST = criarPostTransferencias({ executar });

    const resposta = await POST(requisicao(JSON.stringify(valido)));
    const texto = await resposta.text();

    expect(resposta.status).toBe(500);
    expect(JSON.parse(texto)).toEqual({ erro: 'ERRO_INTERNO' });
    expect(texto).not.toContain('segredo interno');
  });
});
