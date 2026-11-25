import type { SugestaoLida } from "@/modules/clientes/domain/value-objects/parcelamento.vo";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type SugestaoDeParcelamento =
  | (Extract<SugestaoLida, { lido: true }> & { cnpjConfere: boolean | null })
  | Extract<SugestaoLida, { lido: false }>;

export type LerPdfDeParcelamentoInput = { pdf: Uint8Array; clienteId: string };

export interface LerPdfDeParcelamentoPort {
  execute(input: LerPdfDeParcelamentoInput): Promise<Result<SugestaoDeParcelamento, AppError>>;
}
