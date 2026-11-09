import type { EditarCadastroRhClienteInput } from "@/modules/clientes/application/ports/in/editar-cadastro-rh-cliente.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export interface CadastroRhRepository {
  // Grava as observações do RH e troca os contatos do Cliente, numa transação.
  atualizar(
    clienteId: string,
    observacoes: string,
    contatos: EditarCadastroRhClienteInput["contatos"],
  ): Promise<Result<void, AppError>>;
}
