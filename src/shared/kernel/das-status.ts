// Status do DAS (Documento de Arrecadação do Simples Nacional) do Cliente.
export const DAS_STATUSES = ["pendente", "pronto", "enviado", "sem_movimento"] as const;
export type DasStatusValor = (typeof DAS_STATUSES)[number];

export const DAS_STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  pronto: "Pronto",
  enviado: "Enviado",
  sem_movimento: "Sem movimento",
};
