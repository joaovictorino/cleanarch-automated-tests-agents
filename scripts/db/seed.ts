import { Client } from 'pg';

const CONTAS_INICIAIS: ReadonlyArray<readonly [string, string]> = [
  ['123456', '1000.00'],
  ['654321', '200.00'],
];

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL não definida. Copie .env.example para .env.local.');
  }
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    for (const [numero, saldo] of CONTAS_INICIAIS) {
      // Não sobrescreve contas existentes.
      const r = await client.query(
        'INSERT INTO contas (numero, saldo) VALUES ($1, $2) ON CONFLICT (numero) DO NOTHING',
        [numero, saldo],
      );
      console.log(`${numero}: ${r.rowCount ? 'criada' : 'já existia'}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((erro: unknown) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
