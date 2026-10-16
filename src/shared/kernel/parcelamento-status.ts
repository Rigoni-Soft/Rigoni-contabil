// Status do parcelamento do Cliente junto ao Simples Nacional — só relevante quando temParcelamento é true.
export const PARCELAMENTO_STATUSES = ["pendente", "enviado", "interno"] as const;
export type ParcelamentoStatusValor = (typeof PARCELAMENTO_STATUSES)[number];

export const PARCELAMENTO_STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  enviado: "Enviado",
  interno: "Interno",
};
