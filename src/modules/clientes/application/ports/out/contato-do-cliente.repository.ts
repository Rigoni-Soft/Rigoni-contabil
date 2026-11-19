import type { ContatoEditavel } from "@/modules/clientes/domain/value-objects/contato.vo";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export interface ContatoDoClienteRepository {
  // Cria ou atualiza um só contato do Cliente, sem tocar nos outros; devolve o id gravado.
  salvar(clienteId: string, contato: ContatoEditavel): Promise<Result<string, AppError>>;
}
