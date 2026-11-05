'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';

type Lado = 'origem' | 'destino';

const MENSAGENS_ERRO: Record<string, string> = {
  CONTA_INVALIDA: 'Conta inválida',
  VALOR_INVALIDO: 'Valor inválido',
  MESMA_CONTA: 'Origem e destino devem ser contas diferentes',
  CONTA_NAO_ENCONTRADA: 'Conta não encontrada',
};
const MENSAGEM_ERRO_GENERICO = 'Não foi possível concluir a transferência';

const formatoMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

type Saldos = Record<Lado, string>;

async function consultarSaldo(numero: string): Promise<string> {
  const resposta = await fetch(`/api/contas/${numero}`, { cache: 'no-store' });
  if (resposta.status === 404 || resposta.status === 400) return '';
  if (!resposta.ok) throw new Error('consulta');
  const dados: unknown = await resposta.json();
  if (
    typeof dados !== 'object' || dados === null ||
    !('saldo' in dados) || typeof dados.saldo !== 'number'
  ) {
    throw new Error('consulta');
  }
  return formatoMoeda.format(dados.saldo);
}

export function FormularioTransferencia() {
  const [hidratado, setHidratado] = useState(false);
  const [contas, setContas] = useState<Saldos>({ origem: '', destino: '' });
  const [valor, setValor] = useState('');
  const [saldos, setSaldos] = useState<Saldos>({ origem: '', destino: '' });
  const [avisosConta, setAvisosConta] = useState<Saldos>({ origem: '', destino: '' });
  const [enviando, setEnviando] = useState(false);
  const [comprovante, setComprovante] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // Descarta respostas de consultas antigas do mesmo campo.
  const consultaAtual = useRef<Record<Lado, number>>({ origem: 0, destino: 0 });

  // Os campos só ficam habilitados depois da hidratação, para que preenchimentos
  // e cliques não sejam perdidos nem disparem um envio nativo do formulário.
  useEffect(() => setHidratado(true), []);

  async function atualizarSaldo(lado: Lado, numero: string) {
    const id = ++consultaAtual.current[lado];
    // O formato da conta é validado pelo servidor; aqui só se evita consultar campo vazio.
    if (numero === '') {
      setSaldos((anterior) => ({ ...anterior, [lado]: '' }));
      setAvisosConta((anterior) => ({ ...anterior, [lado]: '' }));
      return;
    }
    try {
      const texto = await consultarSaldo(numero);
      if (id !== consultaAtual.current[lado]) return;
      setSaldos((anterior) => ({ ...anterior, [lado]: texto }));
      setAvisosConta((anterior) => ({
        ...anterior,
        [lado]: texto === '' ? 'Conta não encontrada' : '',
      }));
    } catch {
      if (id !== consultaAtual.current[lado]) return;
      setSaldos((anterior) => ({ ...anterior, [lado]: '' }));
      setAvisosConta((anterior) => ({ ...anterior, [lado]: 'Saldo indisponível' }));
    }
  }

  function alterarConta(lado: Lado, novoValor: string) {
    setContas((anterior) => ({ ...anterior, [lado]: novoValor }));
    // Um saldo exibido para o número anterior ficaria enganoso.
    consultaAtual.current[lado] += 1;
    setSaldos((anterior) => ({ ...anterior, [lado]: '' }));
    setAvisosConta((anterior) => ({ ...anterior, [lado]: '' }));
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setComprovante(null);
    setErro(null);

    setEnviando(true);
    try {
      const resposta = await fetch('/api/transferencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contaOrigem: contas.origem,
          contaDestino: contas.destino,
          valor: Number(valor.replace(',', '.')),
        }),
      });
      const corpo: unknown = await resposta.json().catch(() => null);

      if (resposta.status === 201 && typeof corpo === 'object' && corpo !== null &&
          'comprovante' in corpo && typeof corpo.comprovante === 'string') {
        setComprovante(corpo.comprovante);
      } else {
        const codigo =
          typeof corpo === 'object' && corpo !== null && 'erro' in corpo &&
          typeof corpo.erro === 'string' ? corpo.erro : '';
        setErro(
          codigo === 'SALDO_INSUFICIENTE'
            ? 'Saldo insuficiente'
            : MENSAGENS_ERRO[codigo] ?? MENSAGEM_ERRO_GENERICO,
        );
      }
    } catch {
      setErro(MENSAGEM_ERRO_GENERICO);
    } finally {
      setEnviando(false);
    }

    // O saldo exibido vem sempre do servidor, também após rejeições.
    await Promise.all([
      atualizarSaldo('origem', contas.origem),
      atualizarSaldo('destino', contas.destino),
    ]);
  }

  return (
    <form onSubmit={enviar} noValidate>
      <fieldset disabled={!hidratado} style={{ border: 0, padding: 0 }}>
        <p>
          <label htmlFor="conta-origem">Conta origem</label>{' '}
          <input
            id="conta-origem"
            name="contaOrigem"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={contas.origem}
            onChange={(e) => alterarConta('origem', e.target.value)}
            onBlur={() => void atualizarSaldo('origem', contas.origem)}
          />{' '}
          <span>Saldo: </span>
          <span data-testid="saldo-origem">{saldos.origem}</span>
          {avisosConta.origem !== '' && <small> {avisosConta.origem}</small>}
        </p>
        <p>
          <label htmlFor="conta-destino">Conta destino</label>{' '}
          <input
            id="conta-destino"
            name="contaDestino"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={contas.destino}
            onChange={(e) => alterarConta('destino', e.target.value)}
            onBlur={() => void atualizarSaldo('destino', contas.destino)}
          />{' '}
          <span>Saldo: </span>
          <span data-testid="saldo-destino">{saldos.destino}</span>
          {avisosConta.destino !== '' && <small> {avisosConta.destino}</small>}
        </p>
        <p>
          <label htmlFor="valor">Valor (R$)</label>{' '}
          <input
            id="valor"
            name="valor"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
        </p>
        <button type="submit" disabled={enviando}>
          Transferir
        </button>
      </fieldset>

      {comprovante !== null && (
        <section>
          <p role="status">Transferência realizada</p>
          <p>
            Comprovante: <span data-testid="comprovante-id">{comprovante}</span>
          </p>
        </section>
      )}
      {erro !== null && <p role="alert">{erro}</p>}
    </form>
  );
}
