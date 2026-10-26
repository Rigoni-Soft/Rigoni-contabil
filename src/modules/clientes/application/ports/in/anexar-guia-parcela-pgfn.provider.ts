import type { GuiaDaParcela } from "@/modules/clientes/application/ports/out/guia-parcela-pgfn.repository";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type AnexarGuiaParcelaPgfnInput = {
  parcelamentoId: string;
  competencia: string;
  contaNegociacao: string;
  arquivo: File;
};

export interface AnexarGuiaParcelaPgfnPort {
  execute(input: AnexarGuiaParcelaPgfnInput): Promise<Result<GuiaDaParcela, AppError>>;
}
