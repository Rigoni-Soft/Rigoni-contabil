import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type ObterLinkGuiaParcelaPgfnInput = { parcelamentoId: string; competencia: string };

export interface ObterLinkGuiaParcelaPgfnPort {
  execute(input: ObterLinkGuiaParcelaPgfnInput): Promise<Result<{ url: string }, AppError>>;
}
