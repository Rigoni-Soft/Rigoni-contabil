import type { SugestaoLida } from "@/modules/clientes/domain/value-objects/parcelamento.vo";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Sugestão editável: o Funcionário confere e corrige antes de salvar. A falha de leitura não é erro
// (o Result só falha por permissão ou Cliente inexistente); ela volta como `{ lido: false }` e
// libera a digitação à mão. `cnpjConfere` é nulo quando o PDF não trouxe CNPJ legível.
export type SugestaoDeParcelamento =
  | (Extract<SugestaoLida, { lido: true }> & { cnpjConfere: boolean | null })
  | Extract<SugestaoLida, { lido: false }>;

export interface LerPdfDeParcelamentoPort {
  execute(input: {
    pdf: Uint8Array;
    clienteId: string;
  }): Promise<Result<SugestaoDeParcelamento, AppError>>;
}
