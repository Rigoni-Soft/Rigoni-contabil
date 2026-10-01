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

export type ResumoSetorSnDto = { totalClientes: number; cards: CardResumoSnDto[] };
