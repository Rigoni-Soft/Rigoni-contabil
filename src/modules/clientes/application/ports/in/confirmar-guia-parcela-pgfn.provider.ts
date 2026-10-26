import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type ConfirmarGuiaParcelaPgfnInput = { parcelamentoId: string; competencia: string };

export interface ConfirmarGuiaParcelaPgfnPort {
  execute(input: ConfirmarGuiaParcelaPgfnInput): Promise<Result<void, AppError>>;
}
