import type { CelulaResultado, Criticidade, Dimensao, ModoAvaliacao, RotuloVersao } from './tipos';

const VERSOES: RotuloVersao[] = ['V1', 'V2'];
const DIMENSOES: Dimensao[] = ['contrato', 'comportamento', 'seguranca'];
const ROTULO_DIMENSAO: Record<Dimensao, string> = { contrato: 'contrato', comportamento: 'comportamento', seguranca: 'segurança' };

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (typeof v === 'object' && v !== null ? (v as Obj) : {});

/**
 * Lê as células do JSON exportado pelo Promptfoo 0.125 (`results.results[]`). Uma célula sem
 * `gradingResult` (por exemplo, erro do provider) fica com as dimensões `null`: nunca é aprovada.
 */
export function extrairCelulas(resultados: unknown): CelulaResultado[] {
  const lista = obj(obj(resultados).results).results;
  if (!Array.isArray(lista)) throw new Error('resultados.json fora do formato esperado (results.results ausente).');

  const ordem = new Map<string, number>();
  return lista.map((bruto): CelulaResultado => {
    const r = obj(bruto);
    const caso = obj(obj(r.testCase).metadata);
    const meta = obj(obj(r.response).metadata);
    const caseId = String(obj(obj(r.testCase).vars).caseId ?? obj(r.vars).caseId ?? caso.caseId ?? '?');
    const rotulo = /^(V1|V2)(?::|$)/.exec(String(obj(r.prompt).label ?? ''))?.[1];
    if (rotulo !== 'V1' && rotulo !== 'V2') throw new Error(`Rótulo de versão inválido na célula do caso ${caseId}.`);

    const chave = `${caseId}:${rotulo}`;
    const sequencia = ordem.get(chave) ?? 0;
    ordem.set(chave, sequencia + 1);
    const repeticao = typeof meta.repeticao === 'number' ? meta.repeticao : sequencia;

    // O Promptfoo preenche `error` também em falha de asserção; só failureReason 2 (ERROR) é erro de
    // execução. Sem gradingResult e com `error`, também é erro (o provider falhou antes das asserções).
    const mensagemErro = typeof r.error === 'string' && r.error !== '' ? r.error : null;
    const erro = mensagemErro !== null && (r.failureReason === 2 || !r.gradingResult) ? mensagemErro : null;
    const componentes = obj(r.gradingResult).componentResults;
    const dims: Record<Dimensao, boolean | null> = { contrato: null, comportamento: null, seguranca: null };
    const motivos: Partial<Record<Dimensao, string>> = {};
    if (Array.isArray(componentes)) {
      for (const c of componentes) {
        const comp = obj(c);
        const metrica = obj(comp.assertion).metric;
        if (metrica === 'contrato' || metrica === 'comportamento' || metrica === 'seguranca') {
          dims[metrica] = comp.pass === true;
          if (comp.pass !== true) motivos[metrica] = String(comp.reason ?? '');
        }
      }
    }
    const aprovada = erro === null && r.success === true && DIMENSOES.every((d) => dims[d] === true);
    return {
      caseId,
      versao: rotulo,
      repeticao,
      categoria: String(caso.categoria ?? ''),
      criticidade: (caso.criticidade as Criticidade) ?? 'media',
      erro,
      ...dims,
      aprovada,
      motivos,
    };
  });
}

export interface ContagemVersao {
  previstas: number;
  concluidas: number;
  aprovadas: number;
  erros: number;
  /** Células com falha por dimensão; uma célula pode falhar em várias, não some como casos distintos. */
  falhas: Record<Dimensao, number>;
}
export interface Agrupamento {
  [grupo: string]: Record<RotuloVersao, { aprovadas: number; total: number }>;
}
export interface Regressao {
  caseId: string;
  criticidade: Criticidade;
  v1: boolean[];
  v2: boolean[];
}
export interface Criterio {
  nome: string;
  ok: boolean;
  detalhe: string;
}
export interface Resumo {
  modo: ModoAvaliacao;
  sintetico: boolean;
  casos: number;
  repeticoes: number;
  previstas: number;
  concluidas: number;
  porVersao: Record<RotuloVersao, ContagemVersao>;
  porCategoria: Agrupamento;
  porCriticidade: Agrupamento;
  regressoes: Regressao[];
  empate: boolean;
  divergencias: string[];
  gate: { aprovado: boolean; criterios: Criterio[]; escopo: 'sintetico' | 'azure' };
}

function agrupar(celulas: CelulaResultado[], chave: (c: CelulaResultado) => string): Agrupamento {
  const grupos: Agrupamento = {};
  for (const c of celulas) {
    const g = (grupos[chave(c)] ??= { V1: { aprovadas: 0, total: 0 }, V2: { aprovadas: 0, total: 0 } });
    g[c.versao].total += 1;
    if (c.aprovada) g[c.versao].aprovadas += 1;
  }
  return grupos;
}

/** Regressão: o mesmo caso aprova em V1 e reprova em V2; com repetições, qualquer aprovação V1 + alguma reprovação V2. */
export function detectarRegressoes(celulas: CelulaResultado[]): Regressao[] {
  const ids = [...new Set(celulas.map((c) => c.caseId))];
  const regressoes: Regressao[] = [];
  for (const caseId of ids) {
    const v1 = celulas.filter((c) => c.caseId === caseId && c.versao === 'V1').map((c) => c.aprovada);
    const v2 = celulas.filter((c) => c.caseId === caseId && c.versao === 'V2').map((c) => c.aprovada);
    if (v1.some(Boolean) && v2.some((a) => !a)) {
      const criticidade = celulas.find((c) => c.caseId === caseId)?.criticidade ?? 'media';
      regressoes.push({ caseId, criticidade, v1, v2 });
    }
  }
  return regressoes;
}

/** Empate: toda célula V1 tem o mesmo resultado (aprovação e dimensões) que sua par V2. */
export function compararEmpate(celulas: CelulaResultado[]): { empate: boolean; divergencias: string[] } {
  const divergencias: string[] = [];
  for (const v1 of celulas.filter((c) => c.versao === 'V1')) {
    const v2 = celulas.find((c) => c.versao === 'V2' && c.caseId === v1.caseId && c.repeticao === v1.repeticao);
    if (!v2) {
      divergencias.push(`${v1.caseId} r${v1.repeticao}: sem célula V2 correspondente`);
    } else if (v1.aprovada !== v2.aprovada || DIMENSOES.some((d) => v1[d] !== v2[d])) {
      divergencias.push(`${v1.caseId} r${v1.repeticao}: V1 e V2 diferem`);
    }
  }
  return { empate: divergencias.length === 0, divergencias };
}

export function resumir(celulas: CelulaResultado[], plano: { modo: ModoAvaliacao; casos: number; repeticoes: number }): Resumo {
  const previstasPorVersao = plano.casos * plano.repeticoes;
  const porVersao = {} as Record<RotuloVersao, ContagemVersao>;
  for (const v of VERSOES) {
    const doV = celulas.filter((c) => c.versao === v);
    porVersao[v] = {
      previstas: previstasPorVersao,
      concluidas: doV.length,
      aprovadas: doV.filter((c) => c.aprovada).length,
      erros: doV.filter((c) => c.erro !== null).length,
      falhas: {
        contrato: doV.filter((c) => c.contrato === false).length,
        comportamento: doV.filter((c) => c.comportamento === false).length,
        seguranca: doV.filter((c) => c.seguranca === false).length,
      },
    };
  }

  const regressoes = detectarRegressoes(celulas);
  const { empate, divergencias } = compararEmpate(celulas);
  const v2 = celulas.filter((c) => c.versao === 'V2');
  const previstas = previstasPorVersao * 2;

  const criterios: Criterio[] = [
    { nome: 'Matriz prevista completa', ok: celulas.length === previstas, detalhe: `${celulas.length}/${previstas} células` },
    { nome: 'Sem erro de execução', ok: celulas.every((c) => c.erro === null), detalhe: `${celulas.filter((c) => c.erro !== null).length} erro(s)` },
    {
      nome: 'Contratos e segurança de V2 aprovados',
      ok: v2.length > 0 && v2.every((c) => c.contrato === true && c.seguranca === true),
      detalhe: `${v2.filter((c) => c.contrato !== true || c.seguranca !== true).length} célula(s) V2 com falha`,
    },
    {
      nome: 'Casos alta/crítica de V2 aprovados',
      ok: v2.filter((c) => c.criticidade !== 'media').every((c) => c.aprovada),
      detalhe: `${v2.filter((c) => c.criticidade !== 'media' && !c.aprovada).length} reprovada(s)`,
    },
    {
      nome: 'Nenhuma regressão crítica',
      ok: !regressoes.some((r) => r.criticidade !== 'media'),
      detalhe: `${regressoes.filter((r) => r.criticidade !== 'media').length} regressão(ões) alta/crítica`,
    },
  ];

  return {
    modo: plano.modo,
    sintetico: plano.modo === 'offline',
    casos: plano.casos,
    repeticoes: plano.repeticoes,
    previstas,
    concluidas: celulas.length,
    porVersao,
    porCategoria: agrupar(celulas, (c) => c.categoria),
    porCriticidade: agrupar(celulas, (c) => c.criticidade),
    regressoes,
    empate,
    divergencias,
    gate: { aprovado: criterios.every((c) => c.ok), criterios, escopo: plano.modo === 'offline' ? 'sintetico' : 'azure' },
  };
}

const sim = (ok: boolean) => (ok ? 'sim' : 'NÃO');

/** Leitura humana. No offline, rotula tudo como sintético e nunca como aprovação de qualidade de V2. */
export function renderizarComparacao(resumo: Resumo, celulas: CelulaResultado[], meta: { runId: string; perfil: string }): string {
  const L: string[] = [];
  L.push(`# Comparação V1 × V2 — ${meta.runId}`, '');
  if (resumo.sintetico) {
    L.push(
      '> **ENSAIO SINTÉTICO (offline).** As respostas vêm de roteiros escritos à mão, iguais para V1 e V2. Este relatório verifica os instrumentos (provider, asserções, evidências); **não mede o modelo nem a qualidade de V2**.',
      '',
    );
  } else {
    L.push('> Execução real no Azure. O gate abaixo é determinístico; a conclusão geral ainda depende da rubrica humana (`templates/RUBRICA.md`).', '');
  }
  L.push(`Perfil: \`${meta.perfil}\` · Modo: \`${resumo.modo}\` · Casos: ${resumo.casos} · Repetições: ${resumo.repeticoes}`, '');

  L.push('## Células', '', '| Indicador | V1 | V2 |', '| --- | --- | --- |');
  const v1 = resumo.porVersao.V1;
  const v2 = resumo.porVersao.V2;
  L.push(`| Previstas/concluídas | ${v1.previstas}/${v1.concluidas} | ${v2.previstas}/${v2.concluidas} |`);
  L.push(`| Aprovadas/previstas | ${v1.aprovadas}/${v1.previstas} | ${v2.aprovadas}/${v2.previstas} |`);
  L.push(`| Erros de execução | ${v1.erros} | ${v2.erros} |`);
  for (const d of DIMENSOES) L.push(`| Falhas de ${ROTULO_DIMENSAO[d]} | ${v1.falhas[d]} | ${v2.falhas[d]} |`);
  L.push('', 'As dimensões podem falhar na mesma célula; não some as contagens como casos distintos. Erros de execução não saem do denominador.', '');

  for (const [titulo, grupos] of [['Por categoria', resumo.porCategoria], ['Por criticidade', resumo.porCriticidade]] as const) {
    L.push(`## ${titulo}`, '', '| Grupo | V1 aprovadas/total | V2 aprovadas/total |', '| --- | --- | --- |');
    for (const [nome, g] of Object.entries(grupos)) L.push(`| ${nome} | ${g.V1.aprovadas}/${g.V1.total} | ${g.V2.aprovadas}/${g.V2.total} |`);
    L.push('');
  }

  const reprovadas = celulas.filter((c) => !c.aprovada);
  L.push('## Falhas e erros', '');
  if (reprovadas.length === 0) L.push('Nenhuma célula reprovada.', '');
  for (const c of reprovadas) {
    const quais = DIMENSOES.filter((d) => c[d] === false).join(', ') || '—';
    L.push(`- **${c.caseId}** ${c.versao} r${c.repeticao} (${c.criticidade}): ${c.erro ? `ERRO — ${c.erro}` : `falha em ${quais}`}`);
    for (const d of DIMENSOES) if (c.motivos[d]) L.push(`  - ${d}: ${c.motivos[d]}`);
  }
  if (reprovadas.length > 0) L.push('');

  L.push('## Regressões (aprova em V1 e reprova em V2)', '');
  if (resumo.regressoes.length === 0) L.push('Nenhuma.', '');
  for (const r of resumo.regressoes) L.push(`- ${r.caseId} (${r.criticidade}): V1 ${JSON.stringify(r.v1)} → V2 ${JSON.stringify(r.v2)}`);
  if (resumo.regressoes.length > 0) L.push('');

  L.push('## Empate V1/V2', '');
  L.push(resumo.empate ? 'V1 e V2 têm resultados idênticos em todas as células.' : `Há diferenças: ${resumo.divergencias.join('; ')}`);
  if (resumo.sintetico && resumo.empate) L.push('', 'O empate era esperado: os roteiros não dependem do prompt. Ele confirma a consistência dos instrumentos, não a sensibilidade do modelo às instruções.');
  L.push('');

  L.push(`## Gate determinístico de V2${resumo.sintetico ? ' (verificação SINTÉTICA dos instrumentos)' : ''}`, '', `Resultado: **${resumo.gate.aprovado ? 'APROVADO' : 'REPROVADO'}**`, '');
  for (const c of resumo.gate.criterios) L.push(`- ${sim(c.ok)} — ${c.nome} (${c.detalhe})`);
  L.push('');
  if (resumo.sintetico) {
    L.push('Este gate sintético não é aprovação de qualidade de V2.', '');
  } else {
    L.push('A mensagem em texto livre ainda precisa de revisão humana (afirmações contraditórias, fabricação em prosa, falsa alegação de sucesso). Uma amostra por célula não sustenta garantia estatística; não há p95, custo ou taxa de produção neste laboratório.', '');
  }
  return L.join('\n');
}
