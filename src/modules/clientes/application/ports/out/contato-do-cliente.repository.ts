import type { ContatoEditavel } from "@/modules/clientes/domain/value-objects/contato.vo";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export interface ContatoDoClienteRepository {
  salvar(clienteId: string, contato: ContatoEditavel): Promise<Result<string, AppError>>;
}
