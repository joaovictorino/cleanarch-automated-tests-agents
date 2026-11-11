import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { carregarArquivo } from '../avaliacao/dataset';
import { gravarManifesto, hashArquivo, versaoPromptfoo, type Manifesto } from '../avaliacao/manifesto';
import { obterPerfil, type Perfil } from '../avaliacao/perfis';
import { gerarComparacao } from '../avaliacao/relatorio';
import { RAIZ } from '../src/caminhos';
import { ambienteSemAzure, validarAzure } from '../avaliacao/ambiente';

const BIN_PROMPTFOO = path.join(RAIZ, 'node_modules', '.bin', 'promptfoo');

function ambienteBase(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PROMPTFOO_CONFIG_DIR: path.join(RAIZ, '.promptfoo'),
    PROMPTFOO_DISABLE_TELEMETRY: '1',
    PROMPTFOO_DISABLE_UPDATE: '1',
    PROMPTFOO_DISABLE_SHARING: '1',
  };
}

function novoRunId(perfil: Perfil): string {
  const t = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  return `${t}-${perfil.nome}-${randomBytes(2).toString('hex')}`;
}

/** Ambiente do subprocesso: o modo é transmitido explicitamente; no offline, nada do Azure passa adiante. */
function ambienteDoPerfil(perfil: Perfil, runId: string, dir: string): NodeJS.ProcessEnv {
  const env = perfil.modo === 'offline' ? ambienteSemAzure(ambienteBase()) : ambienteBase();
  return { ...env, AVALIACAO_PERFIL: perfil.nome, AVALIACAO_RUN_ID: runId, AVALIACAO_DIR: dir };
}

async function executarPromptfoo(args: string[], env: NodeJS.ProcessEnv, terminal: number): Promise<number> {
  return new Promise((resolve) => {
    const filho = spawn(BIN_PROMPTFOO, args, { cwd: RAIZ, env, stdio: ['ignore', 'pipe', 'pipe'] });
    const repassar = (destino: NodeJS.WriteStream) => (parte: Buffer) => {
      destino.write(parte);
      fs.writeSync(terminal, parte);
    };
    filho.stdout.on('data', repassar(process.stdout));
    filho.stderr.on('data', repassar(process.stderr));
    filho.on('error', () => resolve(1));
    filho.on('close', (codigo, sinal) => resolve(codigo ?? (sinal ? 130 : 1)));
  });
}

async function principal(): Promise<number> {
  const nome = process.argv[2];
  if (nome === 'view') {
    // Visualizador local: apenas interativo, sem registrar em evidências.
    fs.mkdirSync(path.join(RAIZ, '.promptfoo'), { recursive: true });
    fs.writeFileSync(path.join(RAIZ, '.promptfoo', 'env-vazio'), '', 'utf8');
    return new Promise<number>((resolve) => {
      // O Promptfoo carrega promptfooconfig.ts mesmo no `view`, e a configuração exige um perfil. O
      // visualizador não executa nada; o perfil offline apenas permite carregar (sem Azure, sem .env).
      const env = { ...ambienteSemAzure(ambienteBase()), AVALIACAO_PERFIL: 'offline' };
      spawn(BIN_PROMPTFOO, ['view', '--env-file', path.join(RAIZ, '.promptfoo', 'env-vazio')], { cwd: RAIZ, env, stdio: 'inherit' }).on('close', (c) => resolve(c ?? 1));
    });
  }
  const perfil = obterPerfil(nome ?? '');

  if (perfil.modo === 'azure') {
    try {
      process.loadEnvFile(path.join(RAIZ, '.env'));
    } catch {
      /* sem .env: usa o ambiente do processo */
    }
    const problema = validarAzure(process.env);
    if (problema) {
      // Nunca cai para o fake em silêncio.
      console.error(`${problema}\nA avaliação Azure não foi executada.`);
      return 2;
    }
  }

  const runId = novoRunId(perfil);
  const dir = path.join(RAIZ, 'evidencias', runId);
  fs.mkdirSync(path.join(dir, 'traces'), { recursive: true });
  const terminal = fs.openSync(path.join(dir, 'terminal.txt'), 'a');
  const log = (texto: string) => {
    console.log(texto);
    fs.writeSync(terminal, `${texto}\n`);
  };

  const casos = carregarArquivo(perfil.dataset).filter((c) => perfil.filtro?.(c) ?? true);
  const previstas = casos.length * perfil.repeticoes * 2;
  const manifesto: Manifesto = {
    runId,
    perfil: perfil.nome,
    modo: perfil.modo,
    sintetico: perfil.modo === 'offline',
    status: 'em_andamento',
    deployment: perfil.modo === 'azure' ? (process.env.AZURE_OPENAI_DEPLOYMENT ?? null) : null,
    parametros: {
      maxConcurrency: 1,
      cache: false,
      repeticoes: perfil.repeticoes,
      maxRodadas: 4,
      maxRetriesCliente: 0,
      parametrosOmitidos: ['temperature', 'seed', 'response_format'],
    },
    versoes: { promptfoo: versaoPromptfoo(), node: process.version },
    hashes: {
      base: hashArquivo(path.join(RAIZ, 'prompts', 'base.txt')),
      v1: hashArquivo(path.join(RAIZ, 'prompts', 'v1.txt')),
      v2: hashArquivo(path.join(RAIZ, 'prompts', 'v2.txt')),
      dataset: hashArquivo(path.join(RAIZ, 'dataset', perfil.dataset)),
    },
    casos: casos.length,
    celulasPrevistas: previstas,
    celulasConcluidas: 0,
    celulasAprovadas: null,
    codigoSaidaPromptfoo: null,
    iniciadoEm: new Date().toISOString(),
    finalizadoEm: null,
  };
  gravarManifesto(dir, manifesto);
  const encerrar = (status: Manifesto['status'], motivo?: string) => {
    manifesto.status = status;
    if (motivo) manifesto.motivoIncompleto = motivo;
    manifesto.finalizadoEm = new Date().toISOString();
    gravarManifesto(dir, manifesto);
  };

  log(`Execução ${runId} — perfil ${perfil.nome} (${perfil.descricao})${perfil.modo === 'offline' ? ' [SINTÉTICO]' : ''}`);
  log(`Células previstas: ${previstas}`);

  // Falha de tipos interrompe: nenhuma alegação de matriz concluída.
  const tipos = spawnSync('npm', ['run', 'typecheck'], { cwd: RAIZ, encoding: 'utf8' });
  fs.writeSync(terminal, `${tipos.stdout ?? ''}${tipos.stderr ?? ''}`);
  if (tipos.status !== 0) {
    log('typecheck falhou: avaliação interrompida.');
    encerrar('incompleto', 'typecheck falhou');
    return 1;
  }
  log('typecheck: ok');

  const interromper = () => {
    encerrar('incompleto', 'interrompido pelo usuário');
    process.exit(130);
  };
  process.once('SIGINT', interromper);
  process.once('SIGTERM', interromper);

  // Offline: o Promptfoo carregaria o .env do diretório; um arquivo vazio explícito impede isso.
  const envVazio = path.join(dir, 'env-offline-vazio');
  if (perfil.modo === 'offline') fs.writeFileSync(envVazio, '', 'utf8');
  const args = [
    'eval', '-c', 'promptfooconfig.ts', '--no-cache', '--max-concurrency', '1', '--no-share', '--no-progress-bar', '--no-table',
    ...(perfil.modo === 'offline' ? ['--env-file', envVazio] : []),
    '-o', path.join(dir, 'resultados.json'),
    ...(perfil.repeticoes > 1 ? ['--repeat', String(perfil.repeticoes)] : []),
  ];
  const codigo = await executarPromptfoo(args, ambienteDoPerfil(perfil, runId, dir), terminal);
  manifesto.codigoSaidaPromptfoo = codigo;

  // Finalização: gera a comparação mesmo com reprovações (código 100 do Promptfoo).
  let completo = false;
  try {
    if (fs.existsSync(path.join(dir, 'resultados.json'))) {
      const r = gerarComparacao(dir, { runId, perfil: perfil.nome, modo: perfil.modo, casos: casos.length, repeticoes: perfil.repeticoes });
      manifesto.celulasConcluidas = r.concluidas;
      manifesto.celulasAprovadas = r.resumo.porVersao.V1.aprovadas + r.resumo.porVersao.V2.aprovadas;
      completo = r.completo;
    }
  } catch (e) {
    log(`Falha ao gerar a comparação: ${e instanceof Error ? e.message : 'erro'}`);
  }
  const tracesGravados = fs.existsSync(path.join(dir, 'traces')) ? fs.readdirSync(path.join(dir, 'traces')).length : 0;
  completo = completo && tracesGravados === previstas;

  encerrar(completo ? 'concluido' : 'incompleto', completo ? undefined : 'matriz ou artefatos incompletos');
  log(`Células concluídas: ${manifesto.celulasConcluidas}/${previstas} · traces: ${tracesGravados} · código Promptfoo: ${codigo}`);
  log(`Evidências em evidencias/${runId}/`);
  if (perfil.modo === 'offline') log('Ensaio SINTÉTICO: exercita os instrumentos; não mede o modelo nem a qualidade de V2.');

  if (codigo !== 0) return codigo; // propaga o código original (100 = reprovações)
  return completo ? 0 : 1; // êxito do runner com artefatos incompletos não é êxito
}

principal().then(
  (c) => process.exit(c),
  (e: unknown) => {
    console.error(`Falha no wrapper: ${e instanceof Error ? e.message : 'erro'}`);
    process.exit(1);
  },
);
