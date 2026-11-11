import type { AssertionValueFunctionContext, GradingResult } from 'promptfoo';
import type { Verificacao } from '../avaliacao/tipos';
import { validarRespostaFinal } from '../src/dominio/contratos';
import { paraGrading } from './comum';

/** Contrato: JSON.parse sem reparo e schema comum por ação (tipos, campos e inteiros). */
export function verificarContrato(outputRaw: string | null | undefined): Verificacao {
  if (typeof outputRaw !== 'string') {
    return { dimensao: 'contrato', pass: false, reason: 'Sem saída bruta do modelo para validar.' };
  }
  const v = validarRespostaFinal(outputRaw);
  return v.valida
    ? { dimensao: 'contrato', pass: true, reason: `Contrato válido (ação ${v.resposta.acao}).` }
    : { dimensao: 'contrato', pass: false, reason: v.motivo };
}

export default function contrato(output: string, _context?: AssertionValueFunctionContext): GradingResult {
  return paraGrading(verificarContrato(output));
}
