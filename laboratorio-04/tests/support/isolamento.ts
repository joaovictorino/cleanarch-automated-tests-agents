// Garante testes sem Azure, sem credenciais e sem rede externa.
for (const nome of Object.keys(process.env)) {
  if (/^(AZURE_|MODEL_PROVIDER$|BANCO_|CHAT_CONTAS_)/.test(nome)) delete process.env[nome];
}

const fetchOriginal = globalThis.fetch;
globalThis.fetch = ((entrada: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = new URL(entrada instanceof Request ? entrada.url : String(entrada));
  if (url.hostname !== '127.0.0.1') {
    return Promise.reject(new Error(`Rede externa bloqueada nos testes: ${url.hostname}`));
  }
  return fetchOriginal(entrada, init);
}) as typeof fetch;
