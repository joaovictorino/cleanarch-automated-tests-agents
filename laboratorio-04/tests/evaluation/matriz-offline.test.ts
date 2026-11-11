import verificarContratoDefault from '../../assertions/contrato';
import { verificarComportamento } from '../../assertions/comportamento';
import { verificarContrato } from '../../assertions/contrato';
import { verificarSeguranca } from '../../assertions/seguranca';
import { carregarArquivo } from '../../avaliacao/dataset';
import { roteiroOffline } from '../../providers/roteiros-offline';
import { caso, executarOffline } from '../support/avaliacao';

const casos = carregarArquivo('casos.json');

describe('matriz offline completa (12 casos × V1/V2 = 24 células), sem Promptfoo', () => {
  test('todas as 24 células aprovam as três dimensões, sem chamadas externas', async () => {
    let celulas = 0;
    for (const c of casos) {
      for (const versao of ['v1', 'v2'] as const) {
        const r = await executarOffline(c.id, versao);
        celulas += 1;
        expect(r.status).toBe('ok');
        expect(r.backend).toBe('memoria');
        expect(r.trace.chamadasBanco).toEqual([]);
        expect(verificarContrato(r.outputRaw).pass).toBe(true);
        expect(verificarComportamento(caso(c.id), r.outputRaw, r.trace).pass).toBe(true);
        expect(verificarSeguranca(caso(c.id), r.outputRaw, r.trace).pass).toBe(true);
      }
    }
    expect(celulas).toBe(24);
  });

  test('V1 e V2 empatam: o roteiro não depende do texto do prompt (verifica instrumentos, não o modelo)', async () => {
    for (const c of casos) {
      const v1 = await executarOffline(c.id, 'v1');
      const v2 = await executarOffline(c.id, 'v2');
      expect(v2.outputRaw).toBe(v1.outputRaw);
      expect(v2.chamadas.map((x) => [x.nome, x.status])).toEqual(v1.chamadas.map((x) => [x.nome, x.status]));
    }
  });

  test('a única diferença entre V1 e V2 é a instrução enviada ao modelo (hash do prompt)', async () => {
    const v1 = await executarOffline('C01', 'v1');
    const v2 = await executarOffline('C01', 'v2');
    expect(v1.trace.promptHash).not.toBe(v2.trace.promptHash);
    expect(v1.trace.ferramentas).toEqual(v2.trace.ferramentas);
  });

  test('os roteiros exercitam o tool loop: casos com ferramenta obrigatória têm chamada executada ou tool_error registrada', async () => {
    for (const c of casos.filter((x) => x.esperado.ferramentasObrigatorias)) {
      const r = await executarOffline(c.id);
      expect(r.chamadas.length).toBeGreaterThan(0);
      expect(r.chamadas.every((x) => x.status === 'executed' || x.status === 'tool_error')).toBe(true);
    }
  });

  test('caso sem roteiro offline falha com erro claro, nunca com resposta inventada', () => {
    expect(() => roteiroOffline('ZZ99')).toThrow(/Sem roteiro offline/);
  });

  test('a asserção de contrato exportada ao Promptfoo reprova uma saída fora do schema', () => {
    expect(verificarContratoDefault('{"acao":"nada"}')).toMatchObject({ pass: false });
  });
});
