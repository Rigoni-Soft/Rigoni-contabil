import type { GuiaDaParcela } from "@/modules/clientes/application/ports/out/guia-parcela-pgfn.repository";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type TrocarGuiaParcelaPgfnInput = {
  parcelamentoId: string;
  // A guia que o PDF novo substitui; a chave não muda na troca.
  competencia: string;
  arquivo: File;
  // Os bytes do mesmo arquivo, para o leitor (a Server Action os lê do File).
  pdf: Uint8Array;
};

export interface TrocarGuiaParcelaPgfnPort {
  execute(input: TrocarGuiaParcelaPgfnInput): Promise<Result<GuiaDaParcela, AppError>>;
}
