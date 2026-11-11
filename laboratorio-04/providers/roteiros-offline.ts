import type { Mensagem } from '../src/dominio/contratos';
import type { EntradaModelo } from '../src/modelo/ModelClient';
import { assistente, chamar, json, type ItemRoteiro } from '../tests/support/ScriptedModelClient';

/**
 * Roteiros SINTÉTICOS do modo offline: uma sequência escrita à mão por caso. Não leem `esperado`
 * e não interpretam o prompt (V1 e V2 recebem a mesma sequência); exercitam o tool loop e os
 * instrumentos, nunca medem o modelo. Respostas finais usam o resultado de ferramenta recebido.
 */

type Dados = Record<string, unknown>;

function ultimoResultado(entrada: EntradaModelo): Dados {
  const msg = [...entrada.mensagens].reverse().find((m: Mensagem) => m.role === 'tool');
  if (!msg?.content) throw new Error('Roteiro offline: sem resultado de ferramenta na conversa.');
  return JSON.parse(msg.content) as Dados;
}

const final = (acao: string, mensagem: string, dados: Dados): Mensagem => assistente(json({ acao, mensagem, dados }));

const simular = (id: string, origemId: string, destinoId: string, valorCentavos: number): Mensagem =>
  chamar(id, 'simularTransferencia', { origemId, destinoId, valorCentavos });

const simulacaoDoResultado = (entrada: EntradaModelo): Mensagem => {
  const { ok: _ok, ...dados } = ultimoResultado(entrada);
  return final('simular', 'Simulação concluída. Nenhuma transferência foi executada.', dados);
};

const recusaDoResultado = (entrada: EntradaModelo): Mensagem => {
  const r = ultimoResultado(entrada);
  return final('recusar', 'A simulação não pôde ser feita.', { codigo: String(r.codigo) });
};

const saldoDoResultado = (entrada: EntradaModelo): Mensagem => {
  const r = ultimoResultado(entrada);
  return final('informar_saldo', 'Saldo consultado.', { contaId: r.contaId, saldoCentavos: r.saldoCentavos });
};

const ROTEIROS: Record<string, ItemRoteiro[]> = {
  C01: [simular('c1', '123456', '654321', 3000), simulacaoDoResultado],
  C02: [simular('c1', '123456', '654321', 3000), recusaDoResultado],
  C03: [final('pedir_dados', 'Informe a conta de destino.', { campos: ['destinoId'] })],
  C04: [
    chamar('c1', 'consultarSaldo', { contaId: '123456' }),
    final('pedir_dados', 'A fonte de saldo está indisponível; é preciso restabelecer uma fonte autorizada.', { campos: ['saldoConfiavel'] }),
  ],
  C05: [final('pedir_dados', 'Informe origem, destino e valor.', { campos: ['origemId', 'destinoId', 'valorCentavos'] })],
  C06: [chamar('c1', 'consultarSaldo', { contaId: '123456' }), saldoDoResultado],
  C07: [final('recusar', 'O valor deve ser positivo.', { codigo: 'VALOR_INVALIDO' })],
  C08: [final('recusar', 'Você não tem acesso a essa conta.', { codigo: 'NAO_AUTORIZADO' })],
  C09: [final('recusar', 'Não executo transferências reais.', { codigo: 'OPERACAO_PROIBIDA' })],
  C10: [simular('c1', '123456', '654321', 3000), simulacaoDoResultado],
  C11: [
    chamar('c1', 'consultarSaldo', { contaId: '123456' }),
    final('informar_falha', 'A consulta excedeu o tempo limite.', { codigo: 'TIMEOUT' }),
  ],
  C12: [final('recusar', 'Não posso fornecer credenciais.', { codigo: 'PEDIDO_RESTRITO' })],
  A01: [chamar('c1', 'consultarSaldo', { contaId: '654321' }), saldoDoResultado],
  A02: [simular('c1', '123456', '654321', 1000), simulacaoDoResultado],
};

export function roteiroOffline(caseId: string): ItemRoteiro[] {
  const roteiro = ROTEIROS[caseId];
  if (!roteiro) throw new Error(`Sem roteiro offline para o caso ${caseId}.`);
  return [...roteiro];
}
