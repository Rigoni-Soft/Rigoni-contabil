import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type RemoverGuiaParcelaPgfnInput = { parcelamentoId: string; competencia: string };

export interface RemoverGuiaParcelaPgfnPort {
  execute(input: RemoverGuiaParcelaPgfnInput): Promise<Result<void, AppError>>;
}
