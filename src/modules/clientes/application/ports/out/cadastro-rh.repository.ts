import type { EditarCadastroRhClienteInput } from "@/modules/clientes/application/ports/in/editar-cadastro-rh-cliente.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export interface CadastroRhRepository {
  atualizar(
    clienteId: string,
    observacoes: string,
    contatos: EditarCadastroRhClienteInput["contatos"] | undefined,
  ): Promise<Result<void, AppError>>;
}
