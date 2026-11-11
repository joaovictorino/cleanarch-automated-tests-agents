import { executarCelula } from '../../avaliacao/celula';
import type { CasoAvaliacao } from '../../avaliacao/tipos';
import { carregarPrompt } from '../../src/prompts';
import { assistente, chamar, json, ScriptedModelClient } from '../support/ScriptedModelClient';
import { obter, textoDe } from '../support/ajuda';
import { caso } from '../support/avaliacao';

const SENTINELA_ORACULO = 'SENTINELA_ORACULO_7d41';
const SALDO_NAO_AUTORIZADO = 5550001;
const SALDO_AUTORIZADO = 7770002;

/** Caso com sentinelas no oráculo, no mapa privado de saldos e na configuração de falha. */
function casoComSentinelas(): CasoAvaliacao {
  const base = caso('C01');
  return {
    ...base,
    esperado: { ...base.esperado, acao: SENTINELA_ORACULO, camposSolicitados: [SENTINELA_ORACULO] },
    ambiente: {
      ...base.ambiente,
      saldosCentavos: { '123456': SALDO_AUTORIZADO, '654321': 2000, '999999': SALDO_NAO_AUTORIZADO },
      falhas: { simularTransferencia: 'TIMEOUT' },
    },
  };
}

describe('vazamento de oráculo e fixture privada', () => {
  test('a requisição inicial ao modelo não contém o esperado, o mapa de saldos nem a falha configurada', async () => {
    const modelo = new ScriptedModelClient([assistente(json({ acao: 'pedir_dados', mensagem: 'x', dados: { campos: ['destinoId'] } }))]);
    await executarCelula({ caso: casoComSentinelas(), versao: 'v2', textoPrompt: carregarPrompt('v2').texto, modelClient: modelo, runId: 't' });

    const inicial = JSON.stringify(obter(modelo.requisicoes[0]));
    expect(inicial).not.toContain(SENTINELA_ORACULO);
    expect(inicial).not.toContain(String(SALDO_AUTORIZADO));
    expect(inicial).not.toContain(String(SALDO_NAO_AUTORIZADO));
    // "TIMEOUT" aparece legitimamente no texto da V2; o vazamento seria a configuração de falha em si.
    expect(inicial).not.toContain('falhas');
    expect(inicial).not.toMatch(/simularTransferencia"\s*:\s*"TIMEOUT"/);
    expect(inicial).not.toContain('esperado');
    expect(inicial).not.toContain('saldosCentavos');
  });

  test('depois de uma ferramenta autorizada, o valor retornado por ela pode aparecer; o resto continua oculto', async () => {
    const base = casoComSentinelas();
    const sem_falha = { ...base, ambiente: { ...base.ambiente, falhas: {} } };
    const modelo = new ScriptedModelClient([
      chamar('c1', 'consultarSaldo', { contaId: '123456' }),
      assistente(json({ acao: 'informar_saldo', mensagem: 'x', dados: { contaId: '123456', saldoCentavos: SALDO_AUTORIZADO } })),
    ]);
    await executarCelula({ caso: sem_falha, versao: 'v2', textoPrompt: carregarPrompt('v2').texto, modelClient: modelo, runId: 't' });

    const segunda = textoDe(obter(modelo.requisicoes[1]).mensagens);
    expect(segunda).toContain(String(SALDO_AUTORIZADO));
    expect(segunda).not.toContain(SENTINELA_ORACULO);
    expect(segunda).not.toContain(String(SALDO_NAO_AUTORIZADO));
  });

  test('o contexto externo do caso vai delimitado como não confiável, nunca no system', async () => {
    const modelo = new ScriptedModelClient([assistente(json({ acao: 'pedir_dados', mensagem: 'x', dados: { campos: ['destinoId'] } }))]);
    await executarCelula({ caso: caso('C10'), versao: 'v1', textoPrompt: carregarPrompt('v1').texto, modelClient: modelo, runId: 't' });
    const msgs = obter(modelo.requisicoes[0]).mensagens;
    expect(obter(msgs[0]?.content)).not.toContain('executarTransferencia');
    expect(obter(msgs.find((m) => m.role === 'user')?.content)).toContain('CONTEUDO_EXTERNO_NAO_CONFIAVEL');
  });
});

describe('isolamento entre células', () => {
  test('cada célula parte de uma cópia nova do ambiente: o dataset em memória nunca é alterado', async () => {
    const c = caso('C01');
    const antes = structuredClone(c.ambiente);
    const roteiro = () => [
      chamar('c1', 'consultarSaldo', { contaId: '123456' }),
      assistente(json({ acao: 'informar_saldo', mensagem: 'x', dados: { contaId: '123456', saldoCentavos: 10000 } })),
    ];
    const m1 = new ScriptedModelClient(roteiro());
    const m2 = new ScriptedModelClient(roteiro());
    const r1 = await executarCelula({ caso: c, versao: 'v1', textoPrompt: carregarPrompt('v1').texto, modelClient: m1, runId: 't' });
    const r2 = await executarCelula({ caso: c, versao: 'v2', textoPrompt: carregarPrompt('v2').texto, modelClient: m2, runId: 't' });

    expect(c.ambiente).toEqual(antes);
    expect(r1.trace.traceId).not.toBe(r2.trace.traceId);
    // Histórico vazio: a 2ª célula recebe só system + a mensagem do caso, nada da 1ª.
    const primeiraRequisicao = obter(m2.requisicoes[0]).mensagens;
    expect(primeiraRequisicao.map((m) => m.role)).toEqual(['system', 'user']);
  });

  test('o texto do prompt entregue pelo Promptfoo precisa coincidir com o arquivo da versão', async () => {
    const modelo = new ScriptedModelClient([]);
    await expect(
      executarCelula({ caso: caso('C01'), versao: 'v1', textoPrompt: 'texto adulterado', modelClient: modelo, runId: 't' }),
    ).rejects.toThrow(/não corresponde/);
    expect(modelo.requisicoes).toHaveLength(0);
  });
});
