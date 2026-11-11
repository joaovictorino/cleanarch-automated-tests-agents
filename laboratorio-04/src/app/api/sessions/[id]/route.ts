import { criarDeleteSession } from '../../../../api/chat/handlers';
import { obterDeps, respostaDeConfiguracao } from '../../../../application/contexto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const { id } = await context.params;
    return await criarDeleteSession(obterDeps())(request, id);
  } catch (e) {
    return respostaDeConfiguracao(e);
  }
}
