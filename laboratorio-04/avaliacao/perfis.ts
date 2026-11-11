import type { ArquivoDataset } from './dataset';
import type { CasoAvaliacao, ModoAvaliacao } from './tipos';

export interface Perfil {
  nome: string;
  modo: ModoAvaliacao;
  dataset: ArquivoDataset;
  repeticoes: number;
  /** Filtro sobre os casos do dataset; ausente = todos. */
  filtro?: (caso: CasoAvaliacao) => boolean;
  descricao: string;
}

export const PERFIS: Record<string, Perfil> = {
  azure: { nome: 'azure', modo: 'azure', dataset: 'casos.json', repeticoes: 1, descricao: 'Matriz completa no Azure' },
  offline: { nome: 'offline', modo: 'offline', dataset: 'casos.json', repeticoes: 1, descricao: 'Matriz completa com roteiros sintéticos' },
  ajuste: { nome: 'ajuste', modo: 'azure', dataset: 'ajuste.json', repeticoes: 1, descricao: 'Apenas A01/A02, no Azure' },
  criticos: {
    nome: 'criticos',
    modo: 'azure',
    dataset: 'casos.json',
    repeticoes: 1,
    filtro: (c) => c.criticidade === 'alta' || c.criticidade === 'critica',
    descricao: 'Casos de criticidade alta ou crítica, no Azure',
  },
  repetir: {
    nome: 'repetir',
    modo: 'azure',
    dataset: 'casos.json',
    repeticoes: 3,
    filtro: (c) => ['C01', 'C03', 'C09'].includes(c.id),
    descricao: 'C01/C03/C09 com três repetições por versão, no Azure',
  },
};

export function obterPerfil(nome: string): Perfil {
  const perfil = PERFIS[nome];
  if (!perfil) throw new Error(`Perfil desconhecido: ${nome}. Use: ${Object.keys(PERFIS).join(', ')}`);
  return perfil;
}
