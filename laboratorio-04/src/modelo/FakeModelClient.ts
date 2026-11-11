import type { Mensagem, ResultadoFerramenta } from '../dominio/contratos';
import { EXEMPLOS_FAKE } from './exemplos';
import type { EntradaModelo, ModelClient, SaidaModelo } from './ModelClient';

export { EXEMPLOS_FAKE };

const MARCADOR_EXTERNO = '<<<CONTEUDO_EXTERNO_NAO_CONFIAVEL';

function final(acao: string, mensagem: string, dados: unknown): SaidaModelo {
  return { mensagem: { role: 'assistant', content: JSON.stringify({ acao, mensagem, dados }) } };
}

function chamar(id: string, nome: string, args: unknown): SaidaModelo {
  return {
    mensagem: {
      role: 'assistant',
      content: null,
      tool_calls: [{ id, type: 'function', function: { name: nome, arguments: JSON.stringify(args) } }],
    },
  };
}

/**
 * Dublê ROTEIRIZADO: reconhece três frases exatas. Não interpreta linguagem natural e não lê
 * oráculos. Implementa o mesmo protocolo do cliente real, então passa pelo loop normal.
 */
export class FakeModelClient implements ModelClient {
  readonly modo = 'fake' as const;

  async completar(entrada: EntradaModelo): Promise<SaidaModelo> {
    const msgs = entrada.mensagens;
    const ultima = msgs[msgs.length - 1];
    if (ultima?.role === 'tool') return this.concluirComResultados(msgs);

    const usuario = [...msgs].reverse().find((m) => m.role === 'user')?.content ?? '';
    const texto = usuario.split(MARCADOR_EXTERNO)[0].trim();

    if (texto === EXEMPLOS_FAKE[0]) return chamar('fake_call_1', 'consultarSaldo', { contaId: '123456' });
    if (texto === EXEMPLOS_FAKE[1]) {
      return chamar('fake_call_1', 'simularTransferencia', {
        origemId: '123456',
        destinoId: '654321',
        valorCentavos: 3000,
      });
    }
    if (texto === EXEMPLOS_FAKE[2]) {
      return final('pedir_dados', 'Informe a conta de destino para simular a transferência.', {
        campos: ['destinoId'],
      });
    }
    return final(
      'recusar',
      `Modo roteirizado: só reconheço três exemplos exatos (${EXEMPLOS_FAKE.map((e) => `"${e}"`).join('; ')}). Este modo não interpreta linguagem natural.`,
      { codigo: 'DADOS_INVALIDOS' },
    );
  }

  /** Monta a resposta final com os resultados de ferramenta efetivamente recebidos. */
  private concluirComResultados(msgs: Mensagem[]): SaidaModelo {
    const ultimoAssistente = [...msgs].reverse().find((m) => m.role === 'assistant' && m.tool_calls?.length);
    const chamada = ultimoAssistente?.tool_calls?.[0];
    const resposta = [...msgs].reverse().find((m) => m.role === 'tool' && m.tool_call_id === chamada?.id);
    if (!chamada || !resposta?.content) {
      return final('informar_falha', 'Não recebi o resultado da ferramenta.', { codigo: 'FALHA_FERRAMENTA' });
    }
    const resultado = JSON.parse(resposta.content) as ResultadoFerramenta;

    if (!resultado.ok) {
      if (resultado.codigo === 'TIMEOUT') {
        return final('informar_falha', 'A ferramenta excedeu o tempo limite.', { codigo: 'TIMEOUT' });
      }
      if (resultado.codigo === 'FONTE_INDISPONIVEL') {
        return final('pedir_dados', 'A fonte de saldo está indisponível; é preciso restabelecer uma fonte autorizada.', {
          campos: ['saldoConfiavel'],
        });
      }
      const recusas = ['NAO_AUTORIZADO', 'VALOR_INVALIDO', 'SALDO_INSUFICIENTE', 'DADOS_INVALIDOS'];
      return recusas.includes(resultado.codigo)
        ? final('recusar', resultado.mensagem, { codigo: resultado.codigo })
        : final('informar_falha', 'A ferramenta falhou.', { codigo: 'FALHA_FERRAMENTA' });
    }
    if ('saldoCentavos' in resultado) {
      return final('informar_saldo', 'Saldo consultado.', {
        contaId: resultado.contaId,
        saldoCentavos: resultado.saldoCentavos,
      });
    }
    const { ok: _ok, ...dados } = resultado;
    return final('simular', 'Simulação concluída. Nenhuma transferência foi executada.', dados);
  }
}
