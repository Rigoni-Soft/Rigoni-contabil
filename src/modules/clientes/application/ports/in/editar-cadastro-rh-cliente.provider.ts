import type { ContatoProps } from "@/modules/clientes/domain/value-objects/contato.vo";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type EditarCadastroRhClienteInput = {
  clienteId: string;
  observacoes: string;
  contatos?: ContatoProps[];
};

export interface EditarCadastroRhClientePort {
  execute(input: EditarCadastroRhClienteInput): Promise<Result<{ clienteId: string }, AppError>>;
}
