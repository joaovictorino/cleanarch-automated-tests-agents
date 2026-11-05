import type { OperacaoTransferencia } from '../../api/transferencias/handler';
import { Conta } from '../../domain/Conta';
import { ErroNegocio } from '../../domain/ErroNegocio';
import { NumeroConta } from '../../domain/NumeroConta';
import { Recibo } from '../../domain/Recibo';
import { TransferenciaValor } from '../../domain/TransferenciaValor';

export function criarOperacaoTransferencia(
  contas: ReadonlyMap<string, Conta>,
  gerarCodigo: () => string = Recibo.gerarCodigoAleatorio,
): OperacaoTransferencia {
  const transferencia = new TransferenciaValor(gerarCodigo);
  // Gerador próprio para a verificação prévia, sem consumir o gerador de comprovantes.
  const verificacao = new TransferenciaValor(() => '000000');

  return {
    executar({ contaOrigem, contaDestino, valor }) {
      // Precedência: formato das contas → valor → mesma conta → existência → regras de transferência.
      // Valor e mesma conta são checados com as classes reais sobre contas descartáveis,
      // sem duplicar regras e sem tocar nas contas cadastradas.
      const numeroOrigem = new NumeroConta(contaOrigem).numero;
      const numeroDestino = new NumeroConta(contaDestino).numero;
      new Conta(numeroOrigem, Number.MAX_SAFE_INTEGER).sacar(valor);
      verificacao.transferir(
        new Conta(numeroOrigem, Number.MAX_SAFE_INTEGER),
        new Conta(numeroDestino, 0),
        valor,
      );

      const origem = contas.get(numeroOrigem);
      const destino = contas.get(numeroDestino);
      if (origem === undefined || destino === undefined) {
        throw new ErroNegocio('CONTA_NAO_ENCONTRADA', 'Conta de origem ou destino não cadastrada');
      }
      const recibo = transferencia.transferir(origem, destino, valor);
      return { comprovante: recibo.codigo };
    },
  };
}
