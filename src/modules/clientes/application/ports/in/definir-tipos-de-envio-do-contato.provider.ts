import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// O tipo que vale para "todos os envios do Setor".
export const TIPO_TODOS_OS_ENVIOS = "todos";

export type DefinirTiposDeEnvioDoContatoInput = {
  clienteId: string;
  contatoId: string;
  // Os tipos do catálogo do Setor (ou "todos") que este contato recebe; vazio = nenhum.
  tipos: string[];
};

export interface DefinirTiposDeEnvioDoContatoPort {
  execute(input: DefinirTiposDeEnvioDoContatoInput): Promise<Result<void, AppError>>;
}
