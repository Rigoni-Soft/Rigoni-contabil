import type { SugestaoLida } from "@/modules/clientes/domain/value-objects/parcelamento.vo";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Sugestão editável: o Funcionário confere e corrige antes de salvar. A falha de leitura não é erro
// (o Result só falha por permissão); ela volta como `{ lido: false }` e libera a digitação à mão.
export type SugestaoDeParcelamento = SugestaoLida;

export interface LerPdfDeParcelamentoPort {
  execute(input: { pdf: Uint8Array }): Promise<Result<SugestaoDeParcelamento, AppError>>;
}
