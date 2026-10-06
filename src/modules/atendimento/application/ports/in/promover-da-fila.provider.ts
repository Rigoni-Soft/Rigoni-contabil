import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

// Funcionário que ficou livre no Setor: assume o cliente mais antigo da Fila. `null` = ocupado
// ou Fila vazia.
export interface PromoverDaFilaPort {
  execute(input: {
    funcionarioId: string;
    setor: SetorSlug;
  }): Promise<Result<{ atendimentoId: string } | null, AppError>>;
}
