import path from 'node:path';
import type { NextConfig } from 'next';

const config: NextConfig = {
  // Não anuncia o framework nas respostas HTTP do chat.
  poweredByHeader: false,
  // O projeto é independente do Next.js da raiz do repositório: fixa a raiz do workspace aqui.
  turbopack: { root: path.resolve(__dirname) },
};

export default config;
