import { criarGetHealth } from '../../../api/chat/handlers';
import { obterDeps, respostaDeConfiguracao } from '../../../application/contexto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    return await criarGetHealth(obterDeps())(request);
  } catch (e) {
    return respostaDeConfiguracao(e);
  }
}
