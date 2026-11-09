import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export interface CadastroRhRepository {
  // Grava as observações do RH e troca os contatos do Cliente, numa transação.
  atualizar(
    clienteId: string,
    observacoes: string,
    contatos: { id?: string; nome: string; telefone: string; padrao: boolean }[],
  ): Promise<Result<void, AppError>>;
}
