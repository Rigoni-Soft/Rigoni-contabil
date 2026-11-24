import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type AtribuirResponsavelClienteInput = { clienteId: string; responsavelId: string | null };

export interface AtribuirResponsavelClientePort {
  execute(input: AtribuirResponsavelClienteInput): Promise<Result<void, AppError>>;
}
