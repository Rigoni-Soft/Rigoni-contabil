import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export interface ResponsavelClienteRepository {
  atribuir(clienteId: string, responsavelId: string | null): Promise<Result<void, AppError>>;
}
