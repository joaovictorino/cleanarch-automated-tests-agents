import { criarPostTransferencias } from '../../../api/transferencias/handler';
import { operacaoTransferenciaDaAplicacao } from '../../../application/armazenamento';

export const dynamic = 'force-dynamic';

export const POST = criarPostTransferencias(operacaoTransferenciaDaAplicacao);
