import { validarRespostaFinal } from '../../src/dominio/contratos';
import { json } from '../support/ScriptedModelClient';
import { respostaSaldo, respostaSimulacao, SIMULACAO_30 } from '../support/ajuda';

describe('contrato da resposta final', () => {
  test.each<[string, unknown]>([
    ['informar_saldo', respostaSaldo('123456', 10000)],
    ['simular', respostaSimulacao(SIMULACAO_30)],
    ['pedir_dados', { acao: 'pedir_dados', mensagem: 'Informe o destino.', dados: { campos: ['destinoId'] } }],
    ['recusar', { acao: 'recusar', mensagem: 'Não posso executar.', dados: { codigo: 'OPERACAO_PROIBIDA' } }],
    ['informar_falha', { acao: 'informar_falha', mensagem: 'Tempo esgotado.', dados: { codigo: 'TIMEOUT' } }],
  ])('JSON correto de %s é aprovado e preservado', (_acao, obj) => {
    const v = validarRespostaFinal(json(obj));
    expect(v.valida).toBe(true);
    expect(v.valida ? v.resposta : null).toEqual(obj);
  });

  test.each<[string, string]>([
    ['Markdown com cerca', '```json\n{"acao":"recusar","mensagem":"x","dados":{"codigo":"OPERACAO_PROIBIDA"}}\n```'],
    ['JSON inválido', '{acao: "recusar"'],
    ['texto livre', 'O saldo é R$ 100,00.'],
    ['array', '[]'],
    ['campo extra na raiz', json({ ...respostaSaldo('123456', 10000), extra: true })],
    ['campo extra em dados', json({ ...respostaSaldo('123456', 10000), dados: { contaId: '123456', saldoCentavos: 10000, x: 1 } })],
    ['ação desconhecida', json({ acao: 'executar', mensagem: 'x', dados: {} })],
    ['ação incompatível com dados', json({ acao: 'informar_saldo', mensagem: 'x', dados: { campos: ['destinoId'] } })],
    ['saldo fracionado', json(respostaSaldo('123456', 100.5))],
    ['saldo negativo', json(respostaSaldo('123456', -1))],
    ['saldo como string', json(respostaSaldo('123456', '10000' as unknown as number))],
    ['mensagem vazia', json({ ...respostaSaldo('123456', 10000), mensagem: '   ' })],
    ['simulação com campo faltando', json(respostaSimulacao({ origemId: '123456' }))],
    ['pedir_dados sem campos', json({ acao: 'pedir_dados', mensagem: 'x', dados: { campos: [] } })],
    ['recusar com código fora da lista', json({ acao: 'recusar', mensagem: 'x', dados: { codigo: 'OUTRO' } })],
  ])('%s é reprovado sem reparo', (_nome, bruto) => {
    const v = validarRespostaFinal(bruto);
    expect(v.valida).toBe(false);
    expect(v.valida ? '' : v.motivo).toEqual(expect.any(String));
  });
});
