import path from 'node:path';
import { executarTurno } from '../src/assistente';
import { RAIZ, DIR_TRACES } from '../src/caminhos';
import { carregarConfig, ConfigError, type Config } from '../src/config';
import { criarEstado, criarGateway, criarModelClient, segredosDe } from '../src/fabrica';
import { carregarPrompt } from '../src/prompts';
import { TraceEmArquivo } from '../src/trace';

// Carrega o .env local (se existir) com o suporte nativo do Node 24; nunca imprime valores.
try {
  process.loadEnvFile(path.join(RAIZ, '.env'));
} catch {
  /* sem .env: segue com o ambiente do processo */
}

async function main(): Promise<number> {
  const offline = process.argv.slice(2).includes('offline');
  let config: Config;
  try {
    config = carregarConfig(offline ? { ...process.env, MODEL_PROVIDER: 'fake', BANCO_BACKEND: 'memoria' } : process.env);
  } catch (e) {
    console.error(e instanceof ConfigError ? e.message : 'Configuração inválida.');
    return 1;
  }

  const estado = criarEstado(config);
  const contaId = estado.contasAutorizadas[0]!;
  const gateway = criarGateway(config, estado);
  const resultado = await executarTurno({
    mensagem: `Qual é o saldo da conta ${contaId}?`,
    historico: [],
    estado,
    gateway,
    prompt: carregarPrompt('v2'),
    modelClient: criarModelClient(config),
    maxRodadas: config.maxRodadas,
    traceSink: new TraceEmArquivo(DIR_TRACES, segredosDe(config)),
  });

  const { trace } = resultado;
  const consultas = resultado.chamadas.filter((c) => c.nome === 'consultarSaldo' && c.status === 'executed');
  const saldoFerramenta =
    consultas[0]?.resultado && consultas[0].resultado.ok && 'saldoCentavos' in consultas[0].resultado
      ? consultas[0].resultado.saldoCentavos
      : undefined;

  const falhas: string[] = [];
  if (resultado.status !== 'ok') falhas.push(`status ${resultado.status}${resultado.erro ? ` (${resultado.erro.codigo})` : ''}`);
  if (resultado.resposta?.acao !== 'informar_saldo') falhas.push('acao final diferente de informar_saldo');
  if (consultas.length === 0) falhas.push('consultarSaldo não foi executada');
  if (resultado.resposta?.dados.saldoCentavos !== saldoFerramenta) falhas.push('saldo da resposta difere do retornado pela ferramenta');
  if (resultado.resposta?.dados.contaId !== contaId) falhas.push(`contaId da resposta diferente de ${contaId}`);
  if (gateway.backend === 'http') {
    const esperado = `/api/contas/${contaId}`;
    if (trace.chamadasBanco.length === 0 || trace.chamadasBanco.some((c) => c.metodo !== 'GET' || !c.caminho.startsWith('/api/contas/'))) {
      falhas.push('o saldo não veio exclusivamente de GET /api/contas/{id}');
    } else if (!trace.chamadasBanco.some((c) => c.caminho === esperado && c.status === 200)) {
      falhas.push(`GET ${esperado} não retornou 200`);
    }
  }
  if (JSON.stringify(trace.saldosAntes) !== JSON.stringify(trace.saldosDepois)) falhas.push('saldos mudaram (mutação)');

  console.log(`modo: ${resultado.modo}${resultado.modo === 'fake' ? ' (roteirizado)' : ''}`);
  console.log(`backend: ${gateway.backend}`);
  console.log(`status: ${resultado.status}`);
  console.log(`traceId: ${resultado.traceId}`);
  console.log(`trace: ${resultado.caminhoTrace ? path.relative(RAIZ, resultado.caminhoTrace) : '(não gravado)'}`);
  if (falhas.length > 0) {
    console.error(`SMOKE FALHOU: ${falhas.join('; ')}`);
    return 1;
  }
  console.log('SMOKE OK');
  return 0;
}

main().then((c) => process.exit(c), () => {
  console.error('SMOKE FALHOU: erro inesperado.');
  process.exit(1);
});
