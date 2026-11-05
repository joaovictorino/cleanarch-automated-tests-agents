import type { ContaDTO, OperacoesContas } from '../../api/contas/handlers';
import { Conta } from '../../domain/Conta';
import { ErroNegocio } from '../../domain/ErroNegocio';
import { NumeroConta } from '../../domain/NumeroConta';

function paraDTO(conta: Conta): ContaDTO {
  return { numero: conta.numero, saldo: conta.saldo };
}

export function criarOperacoesContas(contas: Map<string, Conta>): OperacoesContas {
  return {
    criar({ numero, saldoInicial }) {
      // Precedência: número (NumeroConta) → saldo (Conta) → duplicidade; nada é inserido antes.
      new NumeroConta(numero);
      const conta = new Conta(numero, saldoInicial);
      if (contas.has(conta.numero)) {
        throw new ErroNegocio('CONTA_JA_EXISTE', 'Já existe uma conta com este número');
      }
      contas.set(conta.numero, conta);
      return paraDTO(conta);
    },

    listar() {
      return Array.from(contas.values(), paraDTO);
    },

    consultar(id) {
      const conta = contas.get(new NumeroConta(id).numero);
      return conta === undefined ? undefined : paraDTO(conta);
    },
  };
}
