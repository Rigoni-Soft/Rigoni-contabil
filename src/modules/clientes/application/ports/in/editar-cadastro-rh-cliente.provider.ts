import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type EditarCadastroRhClienteInput = {
  clienteId: string;
  // Observações gerais do RH: cada Setor tem as suas.
  observacoes: string;
  // Ausente: só as observações mudam e os contatos ficam como estão (o Admin edita só as do RH).
  contatos?: { id?: string; nome: string; telefone: string; padrao: boolean }[];
};

export interface EditarCadastroRhClientePort {
  execute(input: EditarCadastroRhClienteInput): Promise<Result<{ clienteId: string }, AppError>>;
}
