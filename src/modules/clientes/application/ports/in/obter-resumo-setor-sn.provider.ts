// Cores semânticas da tabela de status da spec #24 — mapeadas pra tokens do
// design system na presentation (nunca aqui, application não conhece Tailwind).
export type CorStatusResumo = "em_dia" | "atencao" | "urgente" | "informativo" | "andamento";

export type ClienteBucketDto = { clienteId: string; empresa: string; cnpj: string };

export type CardResumoSnDto = {
  id: string;
  titulo: string;
  cor: CorStatusResumo;
  quantidade: number;
  clientes: ClienteBucketDto[];
};

// Fatia de um gráfico comparativo (#37): id estável + rótulo pt-BR + contagem.
export type FatiaComparativoDto = { id: string; rotulo: string; quantidade: number };

export type ComparativosSnDto = {
  das: FatiaComparativoDto[];
  parcelamento: FatiaComparativoDto[];
  atividade: FatiaComparativoDto[];
  procuracao: FatiaComparativoDto[];
};

export type ResumoSetorSnDto = {
  totalClientes: number;
  cards: CardResumoSnDto[];
  comparativos: ComparativosSnDto;
};
