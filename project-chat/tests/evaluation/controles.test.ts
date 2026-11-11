import { avaliarControle, CONTROLES, executarControles, type ControleNegativo } from '../../avaliacao/controles';

describe('controles negativos', () => {
  test('os quatro defeitos sintéticos são detectados na dimensão esperada', () => {
    const diagnosticos = executarControles();
    expect(diagnosticos.map((d) => [d.controle, d.dimensaoEsperada, d.detectado])).toEqual([
      ['CN1', 'seguranca', true],
      ['CN2', 'comportamento', true],
      ['CN3', 'comportamento', true],
      ['CN4', 'contrato', true],
    ]);
  });

  test('usam as MESMAS asserções da avaliação e cada diagnóstico traz dimensão, motivo e a marca sintética', () => {
    for (const d of executarControles()) {
      expect(d.sintetico).toBe(true);
      expect(d.dimensoes[d.dimensaoEsperada]).toMatchObject({ pass: false, reason: expect.any(String) });
      expect(d.dimensoes[d.dimensaoEsperada].reason.length).toBeGreaterThan(0);
    }
  });

  test('CN1: a resposta é válida e a única falha é a tentativa proibida bloqueada', () => {
    const cn1 = avaliarControle(CONTROLES[0] as ControleNegativo);
    expect(cn1.dimensoes.contrato.pass).toBe(true);
    expect(cn1.dimensoes.comportamento.pass).toBe(true);
    expect(cn1.dimensoes.seguranca).toMatchObject({ pass: false, reason: expect.stringContaining('executarTransferencia') });
  });

  test('CN2: o saldo inventado diverge do retorno autorizado da ferramenta', () => {
    const cn2 = avaliarControle(CONTROLES[1] as ControleNegativo);
    expect(cn2.dimensoes.contrato.pass).toBe(true);
    expect(cn2.dimensoes.comportamento.reason).toContain('saldoCentavos');
  });

  test('um controle defeituoso APROVADO é reportado como não detectado (faz o comando falhar)', () => {
    const controleBom: ControleNegativo = {
      ...(CONTROLES[2] as ControleNegativo),
      id: 'CN-BOM',
      chamadas: (CONTROLES[0] as ControleNegativo).chamadas.slice(0, 1), // inclui a chamada de simulação correta
    };
    const d = avaliarControle(controleBom);
    expect(d.dimensoes.comportamento.pass).toBe(true);
    expect(d.detectado).toBe(false);
    expect(executarControles([controleBom]).every((x) => x.detectado)).toBe(false);
  });
});
