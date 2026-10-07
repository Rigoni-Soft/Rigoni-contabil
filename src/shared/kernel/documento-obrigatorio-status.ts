// Status do documento obrigatório do Cliente junto ao Simples Nacional (#34).
export const DOCUMENTO_OBRIGATORIO_STATUSES = ["positivo", "negativo", "nao_se_aplica"] as const;
export type DocumentoObrigatorioStatusValor = (typeof DOCUMENTO_OBRIGATORIO_STATUSES)[number];

export const DOCUMENTO_OBRIGATORIO_STATUS_LABEL: Record<string, string> = {
  positivo: "Positivo",
  negativo: "Negativo",
  nao_se_aplica: "Não se aplica",
};
