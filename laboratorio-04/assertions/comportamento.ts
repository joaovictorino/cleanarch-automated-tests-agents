import type { AssertionValueFunctionContext, GradingResult } from 'promptfoo';
import type { CasoAvaliacao, Verificacao } from '../avaliacao/tipos';
import type { RegistroChamada } from '../src/dominio/contratos';
import type { Trace } from '../src/trace';
import { contem, entradaDe, igual, lerTolerante, paraGrading, type RespostaTolerante } from './comum';

function argumentosDe(c: RegistroChamada): Record<string, unknown> {
  if (c.argumentosValidados) return c.argumentosValidados;
  try {
    const bruto: unknown = JSON.parse(c.argumentosBrutos);
    return typeof bruto === 'object' && bruto !== null ? (bruto as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function conjuntoIgual(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && new Set(a).size === new Set(b).size && a.every((x) => b.includes(x));
}

/**
 * Comportamento: ação, dados parciais, campos solicitados, ausência de dados inventados e
 * ferramentas obrigatórias (nome, argumentos, status e subconjunto do resultado). Sem trace, reprova.
 */
export function verificarComportamento(caso: CasoAvaliacao, outputRaw: string | null | undefined, trace: Trace | undefined): Verificacao {
  const esperado = caso.esperado;
  const falhas: string[] = [];

  // Leitura tolerante: o contrato é outra dimensão; aqui interessa o que a resposta diz.
  const resposta: RespostaTolerante | null = lerTolerante(outputRaw);

  if (esperado.acao !== undefined || esperado.dadosParciais || esperado.camposSolicitados || esperado.propriedadesDadosAusentes) {
    if (!resposta) {
      falhas.push('saída não é um JSON com acao e dados: ação e dados não verificáveis');
    } else {
      if (esperado.acao !== undefined && resposta.acao !== esperado.acao) {
        falhas.push(`ação "${resposta.acao}" difere da esperada "${esperado.acao}"`);
      }
      if (esperado.dadosParciais) {
        const divergentes = contem(esperado.dadosParciais, resposta.dados, igual);
        if (divergentes.length > 0) falhas.push(`dados divergentes em: ${divergentes.join(', ')}`);
      }
      if (esperado.camposSolicitados) {
        const campos = resposta.dados.campos;
        if (!Array.isArray(campos) || !conjuntoIgual(campos, esperado.camposSolicitados)) {
          falhas.push(`campos solicitados ${JSON.stringify(campos)} diferem de ${JSON.stringify(esperado.camposSolicitados)}`);
        }
      }
      if (esperado.propriedadesDadosAusentes) {
        const presentes = esperado.propriedadesDadosAusentes.filter((p) => p in resposta.dados);
        if (presentes.length > 0) falhas.push(`dados inventados: ${presentes.join(', ')}`);
      }
    }
  }

  if (esperado.semChamadas !== undefined || esperado.ferramentasObrigatorias) {
    if (!trace) {
      falhas.push('trace ausente: chamadas de ferramenta não verificáveis');
    } else {
      if (esperado.semChamadas && trace.chamadas.length > 0) {
        falhas.push(`esperava nenhuma chamada, houve ${trace.chamadas.length}`);
      }
      for (const obrigatoria of esperado.ferramentasObrigatorias ?? []) {
        const statusEsperado = obrigatoria.resultadoParcial.ok === false ? 'tool_error' : 'executed';
        const atende = trace.chamadas.some(
          (c) =>
            c.nome === obrigatoria.nome &&
            c.status === statusEsperado &&
            igual(argumentosDe(c), obrigatoria.argumentos) &&
            c.resultado !== null &&
            contem(obrigatoria.resultadoParcial, c.resultado as unknown as Record<string, unknown>, igual).length === 0,
        );
        if (!atende) falhas.push(`ferramenta obrigatória não satisfeita: ${obrigatoria.nome} ${JSON.stringify(obrigatoria.argumentos)} (${statusEsperado})`);
      }
    }
  }

  return falhas.length === 0
    ? { dimensao: 'comportamento', pass: true, reason: 'Comportamento conforme o esperado.' }
    : { dimensao: 'comportamento', pass: false, reason: falhas.join('; ') };
}

export default function comportamento(output: string, context: AssertionValueFunctionContext): GradingResult {
  const { caso, trace } = entradaDe(context);
  return paraGrading(verificarComportamento(caso, output, trace));
}
