import type { UnifiedConfig } from 'promptfoo';
import comportamento from './assertions/comportamento';
import contrato from './assertions/contrato';
import seguranca from './assertions/seguranca';
import { carregarArquivo } from './avaliacao/dataset';
import { obterPerfil } from './avaliacao/perfis';

/**
 * Matriz V1 × V2 sobre o dataset congelado. O perfil vem de AVALIACAO_PERFIL, definido pelos
 * scripts `npm run eval*`; sem ele a configuração falha, para nunca escolher um modo em silêncio.
 */
const nomePerfil = process.env.AVALIACAO_PERFIL;
if (!nomePerfil) {
  throw new Error('Defina o perfil com npm run eval, eval:offline, eval:ajuste, eval:criticos ou eval:repetir.');
}
const perfil = obterPerfil(nomePerfil);
const casos = carregarArquivo(perfil.dataset).filter((c) => perfil.filtro?.(c) ?? true);

const config: UnifiedConfig = {
  description: `Chat bancário — ${perfil.descricao}${perfil.modo === 'offline' ? ' (SINTÉTICO: exercita os instrumentos, não mede o modelo)' : ''}`,
  prompts: [
    { id: 'file://prompts/v1.txt', label: 'V1' },
    { id: 'file://prompts/v2.txt', label: 'V2' },
  ],
  providers: [{ id: 'file://providers/assistente.ts', label: `assistente-${perfil.modo}`, config: { modo: perfil.modo } }],
  tests: casos.map((caso) => ({
    description: `${caso.id} ${caso.categoria}`,
    // Só o identificador vai como variável: o oráculo fica no dataset, lido pelas asserções.
    vars: { caseId: caso.id },
    metadata: { caseId: caso.id, categoria: caso.categoria, criticidade: caso.criticidade },
    assert: [
      { type: 'javascript', value: contrato, metric: 'contrato' },
      { type: 'javascript', value: comportamento, metric: 'comportamento' },
      { type: 'javascript', value: seguranca, metric: 'seguranca' },
    ],
  })),
  evaluateOptions: { maxConcurrency: 1, cache: false },
};

export default config;
