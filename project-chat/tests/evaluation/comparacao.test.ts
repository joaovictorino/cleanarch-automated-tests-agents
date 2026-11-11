import { compararEmpate, detectarRegressoes, extrairCelulas, renderizarComparacao, resumir } from '../../avaliacao/comparacao';
import type { CelulaResultado, Criticidade, RotuloVersao } from '../../avaliacao/tipos';

function celula(caseId: string, versao: RotuloVersao, parcial: Partial<CelulaResultado> = {}, criticidade: Criticidade = 'alta'): CelulaResultado {
  return {
    caseId,
    versao,
    repeticao: 0,
    categoria: 'cat',
    criticidade,
    erro: null,
    contrato: true,
    comportamento: true,
    seguranca: true,
    aprovada: true,
    motivos: {},
    ...parcial,
  };
}
const reprovada = (caseId: string, versao: RotuloVersao, dim: 'contrato' | 'comportamento' | 'seguranca', criticidade: Criticidade = 'alta') =>
  celula(caseId, versao, { [dim]: false, aprovada: false, motivos: { [dim]: `${dim} falhou` } }, criticidade);
const erroDeProvider = (caseId: string, versao: RotuloVersao) =>
  celula(caseId, versao, { erro: 'infra_error: AZURE_COTA', contrato: null, comportamento: null, seguranca: null, aprovada: false });

describe('regressões', () => {
  test('aprova em V1 e reprova em V2 no mesmo caso é regressão', () => {
    const r = detectarRegressoes([celula('C01', 'V1'), reprovada('C01', 'V2', 'comportamento')]);
    expect(r).toEqual([{ caseId: 'C01', criticidade: 'alta', v1: [true], v2: [false] }]);
  });

  test('reprovar nas duas versões ou melhorar em V2 não é regressão', () => {
    expect(detectarRegressoes([reprovada('C01', 'V1', 'contrato'), reprovada('C01', 'V2', 'contrato')])).toEqual([]);
    expect(detectarRegressoes([reprovada('C01', 'V1', 'contrato'), celula('C01', 'V2')])).toEqual([]);
  });

  test('com repetições, qualquer aprovação V1 com alguma reprovação V2 é sinalizada e mostra todas as observações', () => {
    const celulas = [
      celula('C03', 'V1'), { ...celula('C03', 'V1'), repeticao: 1 }, reprovada('C03', 'V1', 'contrato'),
      celula('C03', 'V2'), { ...reprovada('C03', 'V2', 'contrato'), repeticao: 1 }, { ...celula('C03', 'V2'), repeticao: 2 },
    ].map((c, i) => ({ ...c, repeticao: i % 3 }));
    const [reg] = detectarRegressoes(celulas);
    expect(reg).toMatchObject({ caseId: 'C03', v1: [true, true, false], v2: [true, false, true] });
  });

  test('erro de execução em V2 conta como reprovação para a regressão', () => {
    expect(detectarRegressoes([celula('C01', 'V1'), erroDeProvider('C01', 'V2')])).toHaveLength(1);
  });
});

describe('empate V1/V2', () => {
  test('resultados idênticos em todas as células empatam', () => {
    expect(compararEmpate([celula('C01', 'V1'), celula('C01', 'V2'), celula('C02', 'V1'), celula('C02', 'V2')])).toEqual({ empate: true, divergencias: [] });
  });

  test('qualquer diferença (aprovação ou dimensão) quebra o empate e é listada', () => {
    const r = compararEmpate([celula('C01', 'V1'), reprovada('C01', 'V2', 'seguranca')]);
    expect(r.empate).toBe(false);
    expect(r.divergencias).toEqual(['C01 r0: V1 e V2 diferem']);
  });

  test('célula V1 sem par V2 é divergência, não empate silencioso', () => {
    expect(compararEmpate([celula('C01', 'V1')]).empate).toBe(false);
  });
});

describe('resumo e denominadores', () => {
  const plano = { modo: 'azure' as const, casos: 2, repeticoes: 1 };

  test('previstas, concluídas e aprovadas por versão; erros não saem do denominador', () => {
    const r = resumir([celula('C01', 'V1'), celula('C01', 'V2'), celula('C02', 'V1'), erroDeProvider('C02', 'V2')], plano);
    expect(r.porVersao.V1).toMatchObject({ previstas: 2, concluidas: 2, aprovadas: 2, erros: 0 });
    expect(r.porVersao.V2).toMatchObject({ previstas: 2, concluidas: 2, aprovadas: 1, erros: 1 });
    expect(r.previstas).toBe(4);
  });

  test('falhas por dimensão contam células: uma célula pode falhar em duas dimensões sem virar dois casos', () => {
    const duas = celula('C01', 'V2', { contrato: false, comportamento: false, aprovada: false });
    const r = resumir([celula('C01', 'V1'), duas, celula('C02', 'V1'), celula('C02', 'V2')], plano);
    expect(r.porVersao.V2.falhas).toEqual({ contrato: 1, comportamento: 1, seguranca: 0 });
    expect(r.porVersao.V2.aprovadas).toBe(1);
  });

  test('matriz incompleta (célula faltando) mantém o denominador previsto', () => {
    const r = resumir([celula('C01', 'V1'), celula('C01', 'V2')], plano);
    expect(r.concluidas).toBe(2);
    expect(r.previstas).toBe(4);
    expect(r.gate.criterios[0]).toMatchObject({ nome: 'Matriz prevista completa', ok: false, detalhe: '2/4 células' });
  });

  test('agrupa por categoria e por criticidade', () => {
    const r = resumir([celula('C01', 'V1', { categoria: 'a' }, 'media'), celula('C01', 'V2', { categoria: 'a' }, 'media'), reprovada('C02', 'V1', 'contrato', 'critica'), celula('C02', 'V2', { categoria: 'b' }, 'critica')], plano);
    expect(r.porCriticidade.media).toEqual({ V1: { aprovadas: 1, total: 1 }, V2: { aprovadas: 1, total: 1 } });
    expect(r.porCriticidade.critica?.V1).toEqual({ aprovadas: 0, total: 1 });
    expect(r.porCategoria.a?.V1.total).toBe(1);
  });
});

describe('gate determinístico de V2', () => {
  const plano = { modo: 'azure' as const, casos: 2, repeticoes: 1 };
  const matrizBoa = () => [celula('C01', 'V1'), celula('C01', 'V2'), celula('C02', 'V1', {}, 'media'), celula('C02', 'V2', {}, 'media')];

  test('todos os critérios atendidos aprova', () => {
    expect(resumir(matrizBoa(), plano).gate).toMatchObject({ aprovado: true, escopo: 'azure' });
  });

  test.each<[string, CelulaResultado[]]>([
    ['erro de execução', [celula('C01', 'V1'), erroDeProvider('C01', 'V2'), celula('C02', 'V1'), celula('C02', 'V2')]],
    ['falha de contrato em V2', [celula('C01', 'V1'), reprovada('C01', 'V2', 'contrato'), celula('C02', 'V1'), celula('C02', 'V2')]],
    ['falha de segurança em V2', [celula('C01', 'V1'), reprovada('C01', 'V2', 'seguranca'), celula('C02', 'V1'), celula('C02', 'V2')]],
    ['caso alta reprovado em V2', [reprovada('C01', 'V1', 'comportamento'), reprovada('C01', 'V2', 'comportamento'), celula('C02', 'V1'), celula('C02', 'V2')]],
    ['regressão crítica', [celula('C01', 'V1'), reprovada('C01', 'V2', 'comportamento', 'critica'), celula('C02', 'V1'), celula('C02', 'V2')]],
  ])('%s reprova o gate', (_nome, celulas) => {
    expect(resumir(celulas, plano).gate.aprovado).toBe(false);
  });

  test('reprovação de um caso de criticidade média não reprova o gate sozinha', () => {
    const celulas = [celula('C01', 'V1'), celula('C01', 'V2'), reprovada('C02', 'V1', 'comportamento', 'media'), reprovada('C02', 'V2', 'comportamento', 'media')];
    expect(resumir(celulas, plano).gate.aprovado).toBe(true);
  });

  test('no offline o escopo é sintético', () => {
    expect(resumir(matrizBoa(), { ...plano, modo: 'offline' })).toMatchObject({ sintetico: true, gate: { escopo: 'sintetico' } });
  });
});

describe('leitura dos resultados do Promptfoo', () => {
  const bruto = (resultados: unknown[]) => ({ results: { results: resultados } });
  const ok = (caseId: string, label: string) => ({
    success: true,
    prompt: { label },
    testCase: { vars: { caseId }, metadata: { caseId, categoria: 'cat', criticidade: 'alta' } },
    response: { metadata: { repeticao: 1 } },
    gradingResult: { pass: true, componentResults: ['contrato', 'comportamento', 'seguranca'].map((m) => ({ pass: true, reason: 'ok', assertion: { metric: m } })) },
  });

  test('célula aprovada: rótulo V1/V2 vem do prefixo, repetição do metadata', () => {
    const [c] = extrairCelulas(bruto([ok('C01', 'V2: prompts/v2.txt: texto longo')]));
    expect(c).toMatchObject({ caseId: 'C01', versao: 'V2', repeticao: 1, aprovada: true, contrato: true, comportamento: true, seguranca: true, erro: null });
  });

  test('falha de asserção marca só a dimensão que falhou, com o motivo', () => {
    const falha = ok('C01', 'V1');
    falha.success = false;
    falha.gradingResult.componentResults[1] = { pass: false, reason: 'ferramenta obrigatória não satisfeita', assertion: { metric: 'comportamento' } };
    // O Promptfoo repete o motivo da asserção em `error` com failureReason 1 (ASSERT): não é erro de execução.
    const [c] = extrairCelulas(bruto([{ ...falha, error: 'ferramenta obrigatória não satisfeita', failureReason: 1 }]));
    expect(c).toMatchObject({ aprovada: false, erro: null, contrato: true, comportamento: false, seguranca: true });
    expect(c?.motivos.comportamento).toContain('ferramenta obrigatória');
  });

  test('erro de provider (sem gradingResult) nunca é aprovado e guarda a mensagem', () => {
    const [c] = extrairCelulas(bruto([{ success: false, failureReason: 2, error: 'infra_error: AZURE_COTA: x', prompt: { label: 'V1: a' }, testCase: { vars: { caseId: 'C02' }, metadata: { categoria: 'c', criticidade: 'critica' } } }]));
    expect(c).toMatchObject({ aprovada: false, erro: 'infra_error: AZURE_COTA: x', contrato: null, comportamento: null, seguranca: null });
  });

  test('sem repeticao no metadata, usa a ordem das células do mesmo caso e versão', () => {
    const semMeta = (label: string) => ({ ...ok('C01', label), response: {} });
    const celulas = extrairCelulas(bruto([semMeta('V1: a'), semMeta('V1: a'), semMeta('V2: b')]));
    expect(celulas.map((c) => [c.versao, c.repeticao])).toEqual([['V1', 0], ['V1', 1], ['V2', 0]]);
  });

  test.each<[string, unknown]>([
    ['sem results.results', {}],
    ['rótulo inválido', bruto([{ ...ok('C01', 'V9: x') }])],
  ])('formato inesperado (%s) falha com erro, nunca com resumo vazio', (_nome, entrada) => {
    expect(() => extrairCelulas(entrada)).toThrow();
  });
});

describe('COMPARACAO.md', () => {
  const plano = { casos: 1, repeticoes: 1 };
  const meta = { runId: 'run-1', perfil: 'offline' };

  test('offline é rotulado como sintético e nunca como aprovação de qualidade de V2', () => {
    const celulas = [celula('C01', 'V1'), celula('C01', 'V2')];
    const md = renderizarComparacao(resumir(celulas, { ...plano, modo: 'offline' }), celulas, meta);
    expect(md).toContain('ENSAIO SINTÉTICO');
    expect(md).toContain('não mede o modelo nem a qualidade de V2');
    expect(md).toContain('SINTÉTICA dos instrumentos');
    expect(md).toContain('Este gate sintético não é aprovação de qualidade de V2.');
    expect(md).toContain('V1 e V2 têm resultados idênticos');
  });

  test('Azure lembra a rubrica humana e lista falhas, erros e regressões sem esconder nada', () => {
    const celulas = [celula('C01', 'V1'), reprovada('C01', 'V2', 'seguranca'), erroDeProvider('C02', 'V2'), celula('C02', 'V1')];
    const md = renderizarComparacao(resumir(celulas, { modo: 'azure', casos: 2, repeticoes: 1 }), celulas, { runId: 'run-2', perfil: 'azure' });
    expect(md).not.toContain('ENSAIO SINTÉTICO');
    expect(md).toContain('rubrica humana');
    expect(md).toContain('Resultado: **REPROVADO**');
    expect(md).toContain('falha em seguranca');
    expect(md).toContain('ERRO — infra_error: AZURE_COTA');
    expect(md).toContain('C01 (alta): V1 [true] → V2 [false]');
    expect(md).toContain('segurança');
  });
});
