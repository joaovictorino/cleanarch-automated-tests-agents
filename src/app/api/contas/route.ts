import { criarGetContas, criarPostContas } from '../../../api/contas/handlers';
import { operacoesContasDaAplicacao } from '../../../application/armazenamento';

export const dynamic = 'force-dynamic';

export const GET = criarGetContas(operacoesContasDaAplicacao);
export const POST = criarPostContas(operacoesContasDaAplicacao);
