import type { Cliente } from "@/modules/clientes/domain/entities/cliente.entity";
import type { AlteracaoContratual } from "@/modules/clientes/domain/value-objects/alteracao-contratual.vo";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export interface ClienteRepository {
  // Falha de transporte volta como `ResultadoIncertoError` (a RPC pode ter confirmado).
  criar(cliente: Cliente): Promise<Result<void, AppError>>;
  buscarPorId(id: string): Promise<Result<Cliente | null, AppError>>;
  // Anexa a um Cliente já existente. Nº repetido volta como ValidationError no campo `numero`.
  anexarAlteracaoContratual(
    clienteId: string,
    alteracao: AlteracaoContratual,
  ): Promise<Result<void, AppError>>;
  // Reconciliação depois de `ResultadoIncertoError`: a alteração (Cliente/nº/caminho) foi gravada?
  alteracaoContratualGravada(
    clienteId: string,
    numero: number,
    arquivoCaminho: string,
  ): Promise<Result<boolean, AppError>>;
  atualizarOperacional(cliente: Cliente): Promise<Result<void, AppError>>;
}
