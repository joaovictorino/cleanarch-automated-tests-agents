import { ContasMemoriaGateway } from '../../src/banco/ContasMemoriaGateway';
import type { EstadoSessao } from '../../src/dominio/contratos';
import { consultarSaldo, simularTransferencia } from '../../src/dominio/ferramentas';
import { novoEstado } from '../support/ajuda';

type ArgsSimulacao = { origemId: string; destinoId: string; valorCentavos: unknown };

const consultar = (estado: EstadoSessao, contaId: string) => consultarSaldo(estado, new ContasMemoriaGateway(estado), { contaId });
const simular = (estado: EstadoSessao, args: ArgsSimulacao) => simularTransferencia(estado, new ContasMemoriaGateway(estado), args);
const valido: ArgsSimulacao = { origemId: '123456', destinoId: '654321', valorCentavos: 3000 };

describe('consultarSaldo', () => {
  test('conta autorizada devolve o saldo da fixture em centavos', async () => {
    const r = await consultar(novoEstado(), '123456');
    expect(r).toEqual({ ok: true, contaId: '123456', saldoCentavos: 10000 });
  });

  test.each<[string, Record<string, number | null>]>([
    ['saldo null (fonte indisponível)', { '123456': null, '654321': 2000 }],
    ['conta ausente no mapa', { '654321': 2000 }],
  ])('%s retorna FONTE_INDISPONIVEL', async (_nome, saldos) => {
    const r = await consultar(novoEstado({ saldosCentavos: saldos }), '123456');
    expect(r).toMatchObject({ ok: false, codigo: 'FONTE_INDISPONIVEL' });
  });

  test('timeout injetado na fixture retorna TIMEOUT', async () => {
    const r = await consultar(novoEstado({ falhas: { consultarSaldo: 'TIMEOUT' } }), '123456');
    expect(r).toMatchObject({ ok: false, codigo: 'TIMEOUT' });
  });
});

describe('autorização', () => {
  const estadoComContaPrivada = () => novoEstado({ saldosCentavos: { '123456': 10000, '654321': 2000, '999999': 777777 } });

  test('conta 999999 é bloqueada mesmo existindo no mapa privado, sem vazar o saldo', async () => {
    const r = await consultar(estadoComContaPrivada(), '999999');
    expect(r).toMatchObject({ ok: false, codigo: 'NAO_AUTORIZADO' });
    expect(JSON.stringify(r)).not.toContain('777777');
    expect(JSON.stringify(r)).not.toContain('999999');
  });

  test.each<[string, ArgsSimulacao]>([
    ['origem', { ...valido, origemId: '999999' }],
    ['destino', { ...valido, destinoId: '999999' }],
  ])('simulação com %s não autorizado é bloqueada', async (_nome, args) => {
    const r = await simular(estadoComContaPrivada(), args);
    expect(r).toMatchObject({ ok: false, codigo: 'NAO_AUTORIZADO' });
    expect(JSON.stringify(r)).not.toContain('777777');
  });
});

describe('simularTransferencia', () => {
  test('10000/2000 com valor 3000 projeta 7000/5000 e preserva o estado original', async () => {
    const estado = novoEstado();
    const antes = structuredClone(estado);

    const r = await simular(estado, valido);

    expect(r).toEqual({
      ok: true,
      origemId: '123456',
      destinoId: '654321',
      valorCentavos: 3000,
      saldoOrigemAtualCentavos: 10000,
      saldoDestinoAtualCentavos: 2000,
      saldoOrigemPrevistoCentavos: 7000,
      saldoDestinoPrevistoCentavos: 5000,
    });
    expect(estado).toEqual(antes);
  });

  test('simular duas vezes seguidas produz a mesma projeção (nada foi movimentado)', async () => {
    const estado = novoEstado();
    const primeira = await simular(estado, valido);
    const segunda = await simular(estado, valido);
    expect(segunda).toEqual(primeira);
  });

  test.each<[string, unknown]>([
    ['zero', 0],
    ['negativo', -100],
    ['fração', 30.5],
    ['string numérica', '3000'],
    ['inteiro inseguro', Number.MAX_SAFE_INTEGER + 1],
    ['NaN', NaN],
    ['null', null],
  ])('valor %s é rejeitado com VALOR_INVALIDO', async (_nome, valorCentavos) => {
    const estado = novoEstado();
    const antes = structuredClone(estado);
    const r = await simular(estado, { ...valido, valorCentavos });
    expect(r).toMatchObject({ ok: false, codigo: 'VALOR_INVALIDO' });
    expect(estado).toEqual(antes);
  });

  test('soma que ultrapassa o intervalo seguro é rejeitada', async () => {
    const estado = novoEstado({ saldosCentavos: { '123456': Number.MAX_SAFE_INTEGER, '654321': Number.MAX_SAFE_INTEGER } });
    const r = await simular(estado, { ...valido, valorCentavos: 1 });
    expect(r).toMatchObject({ ok: false, codigo: 'VALOR_INVALIDO' });
  });

  test('contas iguais são rejeitadas com DADOS_INVALIDOS', async () => {
    const r = await simular(novoEstado(), { ...valido, destinoId: '123456' });
    expect(r).toMatchObject({ ok: false, codigo: 'DADOS_INVALIDOS' });
  });

  test('saldo insuficiente retorna SALDO_INSUFICIENTE e nenhum saldo se altera', async () => {
    const estado = novoEstado();
    const antes = structuredClone(estado);
    const r = await simular(estado, { ...valido, valorCentavos: 10001 });
    expect(r).toMatchObject({ ok: false, codigo: 'SALDO_INSUFICIENTE' });
    expect(estado).toEqual(antes);
  });

  test('valor igual ao saldo é permitido e zera a origem', async () => {
    const r = await simular(novoEstado(), { ...valido, valorCentavos: 10000 });
    expect(r).toMatchObject({ ok: true, saldoOrigemPrevistoCentavos: 0, saldoDestinoPrevistoCentavos: 12000 });
  });

  test('fonte indisponível em qualquer das contas retorna FONTE_INDISPONIVEL', async () => {
    const r = await simular(novoEstado({ saldosCentavos: { '123456': 10000, '654321': null } }), valido);
    expect(r).toMatchObject({ ok: false, codigo: 'FONTE_INDISPONIVEL' });
  });

  test('timeout injetado na simulação retorna TIMEOUT sem alterar saldos', async () => {
    const estado = novoEstado({ falhas: { simularTransferencia: 'TIMEOUT' } });
    const antes = structuredClone(estado);
    const r = await simular(estado, valido);
    expect(r).toMatchObject({ ok: false, codigo: 'TIMEOUT' });
    expect(estado).toEqual(antes);
  });
});
