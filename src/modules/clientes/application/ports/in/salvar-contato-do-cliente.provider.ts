import type { ContatoEditavel } from "@/modules/clientes/domain/value-objects/contato.vo";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type SalvarContatoDoClienteInput = {
  clienteId: string;
  contato: ContatoEditavel;
};

export interface SalvarContatoDoClientePort {
  execute(input: SalvarContatoDoClienteInput): Promise<Result<{ id: string }, AppError>>;
}
