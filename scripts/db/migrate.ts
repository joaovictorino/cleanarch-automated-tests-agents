import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL não definida. Copie .env.example para .env.local.');
  }
  const dir = join(process.cwd(), 'db', 'migrations');
  const arquivos = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (versao TEXT PRIMARY KEY, aplicada_em TIMESTAMPTZ NOT NULL DEFAULT now())',
    );
    for (const arquivo of arquivos) {
      const ja = await client.query('SELECT 1 FROM schema_migrations WHERE versao = $1', [arquivo]);
      if (ja.rowCount) {
        console.log(`já aplicada: ${arquivo}`);
        continue;
      }
      await client.query('BEGIN');
      try {
        await client.query(readFileSync(join(dir, arquivo), 'utf8'));
        await client.query('INSERT INTO schema_migrations (versao) VALUES ($1)', [arquivo]);
        await client.query('COMMIT');
        console.log(`aplicada: ${arquivo}`);
      } catch (erro) {
        await client.query('ROLLBACK');
        throw erro;
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((erro: unknown) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
