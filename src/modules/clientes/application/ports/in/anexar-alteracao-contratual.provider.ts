import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type AnexarAlteracaoContratualInput = {
  clienteId: string;
  numero: number;
  data: string;
  arquivo: File;
};

export interface AnexarAlteracaoContratualPort {
  execute(input: AnexarAlteracaoContratualInput): Promise<Result<void, AppError>>;
}
