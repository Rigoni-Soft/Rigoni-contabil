import type { GuiaDaParcela } from "@/modules/clientes/application/ports/out/guia-parcela-pgfn.repository";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export interface ListarGuiasParcelaPgfnPort {
  execute(parcelamentoId: string): Promise<Result<GuiaDaParcela[], AppError>>;
}
