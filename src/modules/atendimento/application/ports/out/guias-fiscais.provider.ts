import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type TipoGuia = "das" | "parcelamento" | "cnd";

export type GuiaFiscal = {
  nomeArquivo: string;
  pdfBase64: string;
  competencia?: string;
  vencimento?: string;
  parcela?: string;
  valorCentavos?: number;
};

export interface GuiasFiscaisPort {
  buscar(clienteId: string, tipo: TipoGuia): Promise<Result<GuiaFiscal, AppError>>;
}
