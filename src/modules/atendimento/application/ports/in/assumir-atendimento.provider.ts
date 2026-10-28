import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type AtendimentoAssumidoPeloUsuario = { atendimentoId: string };

export interface AssumirAtendimentoPort {
  execute(input: {
    atendimentoId: string;
  }): Promise<Result<AtendimentoAssumidoPeloUsuario, AppError>>;
}
