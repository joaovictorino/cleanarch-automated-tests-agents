'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { EnvelopeChat } from '../api/chat/handlers';
import { EXEMPLOS_FAKE } from '../modelo/exemplos';

type Item =
  | { tipo: 'usuario'; texto: string }
  | { tipo: 'erro'; texto: string }
  | { tipo: 'resposta'; envelope: EnvelopeChat };

interface Saude {
  modo: 'azure' | 'fake';
  backend: 'http' | 'memoria';
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function formatarValor(chave: string, valor: unknown): string {
  if (typeof valor === 'number' && chave.endsWith('Centavos')) return brl.format(valor / 100);
  if (Array.isArray(valor)) return valor.join(', ');
  return String(valor);
}

/** Toda saída do modelo é renderizada como texto React (escapado); nunca como HTML. */
function Resposta({ envelope: r }: { envelope: EnvelopeChat }) {
  const ok = r.status === 'ok';
  return (
    <div className={ok ? 'bolha' : 'bolha invalida'}>
      <div className="meta">
        <span className="tag">status: {r.status}</span>
        <span className="tag">{r.modo === 'fake' ? 'roteirizado' : 'modelo real'}</span>
        <span className="tag">{r.backend === 'http' ? 'API bancária' : 'memória'}</span>
        {r.resposta && <span className="tag">ação: {r.resposta.acao}</span>}
      </div>
      {r.resposta ? (
        <>
          <div>{r.resposta.mensagem}</div>
          <ul className="dados">
            {Object.entries(r.resposta.dados).map(([k, v]) => (
              <li key={k}>
                <span>{k}</span>
                <strong>{formatarValor(k, v)}</strong>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <div>Saída fora do contrato JSON. O texto bruto não foi aprovado nem corrigido:</div>
          <textarea className="bruto" readOnly value={r.outputRaw ?? ''} />
          {r.erro && <div className="tag">{`${r.erro.codigo}: ${r.erro.mensagem}`}</div>}
        </>
      )}
      <details>
        <summary>Detalhes (JSON e chamadas)</summary>
        <div>traceId: {r.traceId}</div>
        <pre>
          {`Chamadas:\n${r.chamadasResumo.length ? r.chamadasResumo.map((c) => `${c.nome}: ${c.status}`).join('\n') : '(nenhuma chamada de ferramenta)'}`}
        </pre>
        <pre>{`JSON bruto:\n${r.outputRaw ?? ''}`}</pre>
      </details>
    </div>
  );
}

export default function Chat() {
  const [sessionId, setSessionId] = useState<string | null>(null); // somente em memória da página
  const [saude, setSaude] = useState<Saude | null>(null);
  const [servidorOff, setServidorOff] = useState(false);
  const [versao, setVersao] = useState<'v1' | 'v2'>('v2');
  const [texto, setTexto] = useState('');
  const [itens, setItens] = useState<Item[]>([]);
  const [ocupado, setOcupado] = useState(true);
  const fim = useRef<HTMLDivElement>(null);
  const iniciou = useRef(false);

  const adicionar = useCallback((item: Item) => setItens((atual) => [...atual, item]), []);

  const criarSessao = useCallback(async () => {
    const r = await fetch('/api/sessions', { method: 'POST' });
    if (!r.ok) throw new Error('sessão');
    const corpo = (await r.json()) as { sessionId: string };
    setSessionId(corpo.sessionId);
  }, []);

  useEffect(() => {
    if (iniciou.current) return; // evita sessão dupla no StrictMode
    iniciou.current = true;
    (async () => {
      try {
        const h = await fetch('/api/health');
        if (!h.ok) {
          const corpo = (await h.json()) as { erro?: { mensagem: string } };
          throw new Error(corpo.erro?.mensagem ?? 'saúde');
        }
        setSaude((await h.json()) as Saude);
        await criarSessao();
      } catch (e) {
        setServidorOff(true);
        adicionar({ tipo: 'erro', texto: e instanceof Error && e.message !== 'sessão' && e.message !== 'saúde' ? e.message : 'Não foi possível iniciar a sessão. Verifique se o servidor está rodando.' });
      } finally {
        setOcupado(false);
      }
    })();
  }, [adicionar, criarSessao]);

  useEffect(() => {
    fim.current?.scrollIntoView({ block: 'end' });
  }, [itens]);

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    const mensagem = texto.trim();
    if (ocupado || !mensagem || !sessionId) return;
    adicionar({ tipo: 'usuario', texto: `${mensagem}\n[${versao.toUpperCase()}]` });
    setOcupado(true);
    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, mensagem, versao }),
      });
      const corpo = (await r.json()) as Partial<EnvelopeChat> & { erro?: { mensagem: string } | null };
      if (corpo.status) {
        if (corpo.status === 'infra_error' || corpo.status === 'runtime_error') {
          adicionar({
            tipo: 'erro',
            texto: `${corpo.status === 'infra_error' ? 'Erro de infraestrutura' : 'Erro de execução'}: ${corpo.erro ? corpo.erro.mensagem : 'falha'}`,
          });
        } else {
          adicionar({ tipo: 'resposta', envelope: corpo as EnvelopeChat });
        }
        setTexto('');
      } else {
        adicionar({ tipo: 'erro', texto: `Requisição recusada: ${corpo.erro ? corpo.erro.mensagem : r.status}` });
      }
    } catch {
      adicionar({ tipo: 'erro', texto: 'Falha de comunicação com o servidor. A conversa foi preservada.' });
    } finally {
      setOcupado(false);
    }
  }

  async function novaConversa() {
    if (ocupado) return;
    setOcupado(true);
    try {
      if (sessionId) await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
      setSessionId(null);
      await criarSessao();
      setItens([]);
    } catch {
      adicionar({ tipo: 'erro', texto: 'Não foi possível criar uma nova conversa.' });
    } finally {
      setOcupado(false);
    }
  }

  const contas = saude?.backend === 'http' ? 'contas: API bancária (HTTP)' : 'contas: memória (fixture)';
  const rotuloModo = servidorOff
    ? 'Servidor indisponível'
    : !saude
      ? 'Verificando modo…'
      : `${saude.modo === 'fake' ? 'Modo ROTEIRIZADO (fake) — não interpreta linguagem natural' : 'Modelo REAL (Azure)'} · ${contas}`;

  return (
    <main>
      <header>
        <h1>Chat bancário didático</h1>
        <p className={`modo ${saude?.modo ?? ''}`} role="status">
          {rotuloModo}
        </p>
        <p className="aviso">Consulta e simulação apenas. Nenhuma transferência é executada.</p>
      </header>

      <section className="controles">
        <label>
          Prompt{' '}
          <select value={versao} onChange={(e) => setVersao(e.target.value as 'v1' | 'v2')}>
            <option value="v1">V1</option>
            <option value="v2">V2</option>
          </select>
        </label>
        <button type="button" onClick={novaConversa} disabled={ocupado}>
          Nova conversa
        </button>
      </section>

      {saude?.modo === 'fake' && (
        <section className="exemplos">
          <p>Exemplos do modo roteirizado:</p>
          {EXEMPLOS_FAKE.map((exemplo) => (
            <button key={exemplo} type="button" onClick={() => setTexto(exemplo)}>
              {exemplo}
            </button>
          ))}
        </section>
      )}

      <section className="historico" aria-live="polite">
        {itens.map((item, i) =>
          item.tipo === 'resposta' ? (
            <Resposta key={i} envelope={item.envelope} />
          ) : (
            <div key={i} className={`bolha ${item.tipo}`}>
              {item.texto}
            </div>
          ),
        )}
        <div ref={fim} />
      </section>

      <form onSubmit={enviar}>
        <textarea
          rows={2}
          maxLength={2000}
          placeholder="Digite sua mensagem"
          required
          value={texto}
          disabled={ocupado}
          onChange={(e) => setTexto(e.target.value)}
        />
        <button className="enviar" type="submit" disabled={ocupado || !sessionId}>
          Enviar
        </button>
      </form>
    </main>
  );
}
