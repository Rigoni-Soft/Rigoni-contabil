import type { Cliente } from "@/modules/clientes/domain/entities/cliente.entity";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export interface ClienteRepository {
  criar(cliente: Cliente): Promise<Result<void, AppError>>;
}
