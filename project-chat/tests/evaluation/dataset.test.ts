import { carregarArquivo, validarCaso } from '../../avaliacao/dataset';
import { PERFIS } from '../../avaliacao/perfis';
import { caso } from '../support/avaliacao';

describe('dataset congelado', () => {
  test('casos.json tem C01–C12 e ajuste.json tem A01/A02, sem ids repetidos', () => {
    expect(carregarArquivo('casos.json').map((c) => c.id)).toEqual(['C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C08', 'C09', 'C10', 'C11', 'C12']);
    expect(carregarArquivo('ajuste.json').map((c) => c.id)).toEqual(['A01', 'A02']);
  });

  test('todo ambiente tem a forma de EstadoSessao e usa as contas da fixture', () => {
    for (const c of carregarArquivo('casos.json')) {
      expect(c.ambiente.contasAutorizadas).toEqual(['123456', '654321']);
      expect(c.ambiente.usuarioId).toEqual(expect.any(String));
    }
  });

  test('C08 mantém a conta 999999 só no mapa privado, fora das contas autorizadas', () => {
    const c = caso('C08');
    expect(c.ambiente.saldosCentavos['999999']).toBe(77777);
    expect(c.ambiente.contasAutorizadas).not.toContain('999999');
  });

  test.each<[string, unknown]>([
    ['não é objeto', 42],
    ['sem id', { categoria: 'x' }],
    ['criticidade inválida', { id: 'X', categoria: 'c', criticidade: 'urgente', mensagem: 'm', contextoExterno: '', ambiente: {}, esperado: {} }],
    ['ambiente malformado', { id: 'X', categoria: 'c', criticidade: 'alta', mensagem: 'm', contextoExterno: '', ambiente: { usuarioId: 'u' }, esperado: {} }],
  ])('caso malformado (%s) é rejeitado com erro claro', (_nome, bruto) => {
    expect(() => validarCaso(bruto, 'teste')).toThrow(/teste/);
  });
});

describe('perfis de execução', () => {
  test('offline roda tudo sem Azure; ajuste, críticos e repetir são só Azure', () => {
    expect(PERFIS.offline).toMatchObject({ modo: 'offline', dataset: 'casos.json', repeticoes: 1 });
    expect(PERFIS.azure).toMatchObject({ modo: 'azure' });
    expect(PERFIS.ajuste).toMatchObject({ modo: 'azure', dataset: 'ajuste.json' });
    expect(PERFIS.criticos).toMatchObject({ modo: 'azure' });
    expect(PERFIS.repetir).toMatchObject({ modo: 'azure', repeticoes: 3 });
  });

  test('críticos filtra alta/crítica e repetir filtra C01/C03/C09', () => {
    const todos = carregarArquivo('casos.json');
    expect(todos.filter((c) => PERFIS.criticos?.filtro?.(c)).every((c) => c.criticidade !== 'media')).toBe(true);
    expect(todos.filter((c) => PERFIS.repetir?.filtro?.(c)).map((c) => c.id)).toEqual(['C01', 'C03', 'C09']);
  });
});
