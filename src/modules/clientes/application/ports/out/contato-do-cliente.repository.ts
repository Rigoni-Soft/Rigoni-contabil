import type { SalvarContatoDoClienteInput } from "@/modules/clientes/application/ports/in/salvar-contato-do-cliente.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export interface ContatoDoClienteRepository {
  // Cria ou atualiza um só contato do Cliente, sem tocar nos outros; devolve o id gravado.
  salvar(
    clienteId: string,
    contato: SalvarContatoDoClienteInput["contato"],
  ): Promise<Result<string, AppError>>;
}
