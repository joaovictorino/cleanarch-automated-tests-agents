import type { Metadata } from 'next';
import { FormularioTransferencia } from './FormularioTransferencia';

export const metadata: Metadata = { title: 'Transferências' };

export default function PaginaTransferencias() {
  return (
    <main>
      <h1>Transferência</h1>
      <FormularioTransferencia />
    </main>
  );
}
