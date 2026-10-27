import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type ConfirmarGuiaParcelaPgfnInput = {
  parcelamentoId: string;
  competencia: string;
  // A versão da guia que a tela mostrava (`GuiaDaParcela.versao`).
  versao: string;
};

export interface ConfirmarGuiaParcelaPgfnPort {
  execute(input: ConfirmarGuiaParcelaPgfnInput): Promise<Result<void, AppError>>;
}
