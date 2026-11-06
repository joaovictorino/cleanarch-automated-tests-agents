import { criarGetContaPorId } from '../../../../api/contas/handlers';
import { operacoesContasDaAplicacao } from '../../../../application/armazenamento';

export const dynamic = 'force-dynamic';

const getContaPorId = criarGetContaPorId(operacoesContasDaAplicacao);

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return getContaPorId(request, id);
}
