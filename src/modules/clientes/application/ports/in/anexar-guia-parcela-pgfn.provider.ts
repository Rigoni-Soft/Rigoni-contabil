import type { GuiaDaParcela } from "@/modules/clientes/application/ports/out/guia-parcela-pgfn.repository";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type AnexarGuiaParcelaPgfnInput = {
  parcelamentoId: string;
  // Digitadas só quando o PDF não pôde ser lido (ou para corrigir o que ele traz).
  competencia?: string;
  contaNegociacao?: string;
  arquivo: File;
  // Os bytes do mesmo arquivo, para o leitor (a Server Action os lê do File).
  pdf: Uint8Array;
};

export interface AnexarGuiaParcelaPgfnPort {
  execute(input: AnexarGuiaParcelaPgfnInput): Promise<Result<GuiaDaParcela, AppError>>;
}
