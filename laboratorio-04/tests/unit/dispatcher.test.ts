import { ContasMemoriaGateway } from '../../src/banco/ContasMemoriaGateway';
import type { ChamadaFerramentaMsg, EstadoSessao } from '../../src/dominio/contratos';
import { criarDispatcher } from '../../src/dominio/dispatcher';
import { DEFINICOES_FERRAMENTAS, EXECUTORES } from '../../src/dominio/ferramentas';
import { novoEstado, obter } from '../support/ajuda';

const chamada = (id: string, nome: string, args: unknown): ChamadaFerramentaMsg => ({
  id,
  type: 'function',
  function: { name: nome, arguments: typeof args === 'string' ? args : JSON.stringify(args) },
});
const novoDispatcher = (estado: EstadoSessao = novoEstado()) => criarDispatcher(estado, new ContasMemoriaGateway(estado));

describe('dispatcher', () => {
  test.each(['executarTransferencia', 'ferramentaInexistente'])(
    'nome %s é registrado, bloqueado e a função não é executada',
    async (nome) => {
      const dispatcher = novoDispatcher();
      const chaves = Object.keys(EXECUTORES) as (keyof typeof EXECUTORES)[];
      const espioes = chaves.map((chave) => {
        const original = EXECUTORES[chave];
        const espiao = jest.fn(original);
        EXECUTORES[chave] = espiao;
        return { chave, original, espiao };
      });
      try {
        const resultado = await dispatcher.executar(chamada('c1', nome, { origemId: '123456', destinoId: '654321', valorCentavos: 100 }));

        expect(resultado).toMatchObject({ ok: false, codigo: 'FERRAMENTA_PROIBIDA' });
        expect(dispatcher.chamadas).toHaveLength(1);
        expect(dispatcher.chamadas[0]).toMatchObject({ toolCallId: 'c1', nome, status: 'blocked_by_policy' });
        for (const { espiao } of espioes) expect(espiao).not.toHaveBeenCalled();
      } finally {
        for (const { chave, original } of espioes) EXECUTORES[chave] = original;
      }
    },
  );

  test('executarTransferencia nunca é anunciada ao modelo', () => {
    expect(DEFINICOES_FERRAMENTAS.map((d) => d.function.name)).toEqual(['consultarSaldo', 'simularTransferencia']);
  });

  test.each<[string, unknown]>([
    ['JSON malformado', '{contaId:'],
    ['argumento extra', { contaId: '123456', extra: 1 }],
    ['argumento ausente', {}],
    ['tipo errado', { contaId: 123456 }],
    ['array no lugar do objeto', '[]'],
  ])('argumentos com %s viram invalid_arguments', async (_nome, args) => {
    const dispatcher = novoDispatcher();
    const resultado = await dispatcher.executar(chamada('c1', 'consultarSaldo', args));
    expect(resultado).toMatchObject({ ok: false, codigo: 'DADOS_INVALIDOS' });
    expect(dispatcher.chamadas[0]).toMatchObject({ status: 'invalid_arguments', argumentosValidados: null });
  });

  test('registra a tentativa com argumentos brutos e validados e o status executed', async () => {
    const dispatcher = novoDispatcher();
    const bruto = '{"contaId":"123456"}';
    const resultado = await dispatcher.executar(chamada('c9', 'consultarSaldo', bruto));
    expect(resultado.ok).toBe(true);
    expect(obter(dispatcher.chamadas[0])).toMatchObject({
      toolCallId: 'c9',
      argumentosBrutos: bruto,
      argumentosValidados: { contaId: '123456' },
      status: 'executed',
    });
  });

  test('classifica o status pelo código do resultado', async () => {
    const dispatcher = novoDispatcher();
    await dispatcher.executar(chamada('a', 'consultarSaldo', { contaId: '999999' }));
    await dispatcher.executar(chamada('b', 'simularTransferencia', { origemId: '123456', destinoId: '654321', valorCentavos: 99999999 }));
    await dispatcher.executar(chamada('c', 'simularTransferencia', { origemId: '123456', destinoId: '654321', valorCentavos: 0 }));
    expect(dispatcher.chamadas.map((c) => c.status)).toEqual(['blocked_by_policy', 'tool_error', 'invalid_arguments']);
  });
});
