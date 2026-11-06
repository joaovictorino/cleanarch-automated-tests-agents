import type { OperacaoTransferencia } from '../../api/transferencias/handler';
import { Conta } from '../../domain/Conta';
import { ErroNegocio } from '../../domain/ErroNegocio';
import { NumeroConta } from '../../domain/NumeroConta';
import { Recibo } from '../../domain/Recibo';
import { TransferenciaValor } from '../../domain/TransferenciaValor';

// Gerador próprio para a verificação prévia, sem consumir o gerador de comprovantes.
const verificacao = new TransferenciaValor(() => '000000');

// Precedência: formato das contas → valor → mesma conta (→ existência, no adaptador).
// Valor e mesma conta são checados com as classes reais sobre contas descartáveis,
// sem duplicar regras e sem tocar nas contas cadastradas.
export function validarTransferencia(
  contaOrigem: string,
  contaDestino: string,
  valor: number,
): { numeroOrigem: string; numeroDestino: string } {
  const numeroOrigem = new NumeroConta(contaOrigem).numero;
  const numeroDestino = new NumeroConta(contaDestino).numero;
  new Conta(numeroOrigem, Number.MAX_SAFE_INTEGER).sacar(valor);
  verificacao.transferir(
    new Conta(numeroOrigem, Number.MAX_SAFE_INTEGER),
    new Conta(numeroDestino, 0),
    valor,
  );
  return { numeroOrigem, numeroDestino };
}

export function criarOperacaoTransferencia(
  contas: ReadonlyMap<string, Conta>,
  gerarCodigo: () => string = Recibo.gerarCodigoAleatorio,
): OperacaoTransferencia {
  const transferencia = new TransferenciaValor(gerarCodigo);

  return {
    executar({ contaOrigem, contaDestino, valor }) {
      const { numeroOrigem, numeroDestino } = validarTransferencia(contaOrigem, contaDestino, valor);

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
