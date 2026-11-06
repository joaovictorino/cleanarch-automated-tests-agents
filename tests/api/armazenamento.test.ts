import { criarOperacoesAplicacao } from '../../src/application/armazenamento';

describe('seleção de armazenamento', () => {
  test('usa memória quando CONTAS_STORAGE está ausente, mesmo com DATABASE_URL', async () => {
    const ops = await criarOperacoesAplicacao({
      DATABASE_URL: 'postgresql://invalido:invalido@127.0.0.1:1/x',
    });

    expect(await ops.contas.listar()).toBeDefined();
  });

  test('rejeita valor desconhecido de CONTAS_STORAGE', async () => {
    await expect(criarOperacoesAplicacao({ CONTAS_STORAGE: 'mongo' })).rejects.toThrow(
      'CONTAS_STORAGE inválido',
    );
  });

  test('postgres sem DATABASE_URL falha com mensagem clara', async () => {
    await expect(criarOperacoesAplicacao({ CONTAS_STORAGE: 'postgres' })).rejects.toThrow(
      'DATABASE_URL',
    );
  });
});
