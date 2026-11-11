import { criarPostChat } from '../../../api/chat/handlers';
import { obterDeps, respostaDeConfiguracao } from '../../../application/contexto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  try {
    return await criarPostChat(obterDeps())(request);
  } catch (e) {
    return respostaDeConfiguracao(e);
  }
}
