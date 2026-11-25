import type { GuiaDaParcela } from "@/modules/clientes/application/ports/out/guia-parcela-pgfn.repository";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type TrocarGuiaParcelaPgfnInput = {
  parcelamentoId: string;
  competencia: string;
  arquivo: File;
  pdf: Uint8Array;
};

export interface TrocarGuiaParcelaPgfnPort {
  execute(input: TrocarGuiaParcelaPgfnInput): Promise<Result<GuiaDaParcela, AppError>>;
}
