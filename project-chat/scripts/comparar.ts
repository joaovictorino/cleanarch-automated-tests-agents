import fs from 'node:fs';
import path from 'node:path';
import { gerarComparacao, type PlanoManifesto } from '../avaliacao/relatorio';
import { RAIZ } from '../src/caminhos';

/** `tsx scripts/comparar.ts <runId|diretório>`: regenera resumo.json e COMPARACAO.md de uma execução. */
const alvo = process.argv[2];
if (!alvo) {
  console.error('Uso: tsx scripts/comparar.ts <runId|diretório>');
  process.exit(2);
}
const dir = fs.existsSync(alvo) ? path.resolve(alvo) : path.join(RAIZ, 'evidencias', alvo);
const manifesto = JSON.parse(fs.readFileSync(path.join(dir, 'manifesto.json'), 'utf8')) as PlanoManifesto;
const r = gerarComparacao(dir, manifesto);
console.log(`Comparação gerada em ${path.relative(RAIZ, dir)}: ${r.concluidas}/${r.previstas} células.`);
process.exit(r.completo ? 0 : 1);
