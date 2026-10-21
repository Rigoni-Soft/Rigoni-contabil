import type { Cliente } from "@/modules/clientes/domain/entities/cliente.entity";
import type { AlteracaoContratual } from "@/modules/clientes/domain/value-objects/alteracao-contratual.vo";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export interface ClienteRepository {
  criar(cliente: Cliente): Promise<Result<void, AppError>>;
  buscarPorId(id: string): Promise<Result<Cliente | null, AppError>>;
  // Anexa a um Cliente já existente. Nº repetido volta como ValidationError no campo `numero`.
  anexarAlteracaoContratual(
    clienteId: string,
    alteracao: AlteracaoContratual,
  ): Promise<Result<void, AppError>>;
  atualizarOperacional(cliente: Cliente): Promise<Result<void, AppError>>;
}
