import fs from 'node:fs';
import path from 'node:path';
import { executarControles } from '../avaliacao/controles';
import { RAIZ } from '../src/caminhos';

/** `npm run exemplos`: sucesso só se os quatro defeitos sintéticos forem detectados. */
const diagnosticos = executarControles();
const destino = path.join(RAIZ, 'evidencias-exemplo', 'controles-negativos');
fs.mkdirSync(destino, { recursive: true });
fs.writeFileSync(
  path.join(destino, 'diagnosticos.json'),
  `${JSON.stringify({ aviso: 'CONTROLES SINTÉTICOS: não são resultados de avaliação real.', controles: diagnosticos }, null, 2)}\n`,
  'utf8',
);

for (const d of diagnosticos) {
  console.log(`${d.detectado ? 'DETECTADO ' : 'NÃO DETECTADO'} ${d.controle} [${d.dimensaoEsperada}] ${d.descricao}`);
}
const falhos = diagnosticos.filter((d) => !d.detectado);
if (falhos.length > 0) {
  console.error(`CONTROLES FALHARAM: ${falhos.map((d) => d.controle).join(', ')} não foram detectados (controle defeituoso aprovado).`);
  process.exit(1);
}
console.log('Controles negativos (sintéticos): 4/4 detectados.');
