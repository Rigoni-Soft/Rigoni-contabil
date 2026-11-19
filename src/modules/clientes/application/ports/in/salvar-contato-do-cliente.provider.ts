import type { ContatoProps } from "@/modules/clientes/domain/value-objects/contato.vo";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type SalvarContatoDoClienteInput = {
  clienteId: string;
  // Sem `id`, o contato é criado; com `id`, é atualizado.
  contato: Pick<ContatoProps, "id" | "nome" | "telefone" | "email">;
};

export interface SalvarContatoDoClientePort {
  // Devolve o id do contato gravado (o da linha, que passa a ser "salva").
  execute(input: SalvarContatoDoClienteInput): Promise<Result<{ id: string }, AppError>>;
}
