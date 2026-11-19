import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export interface TiposDeEnvioDoContatoRepository {
  // Troca os tipos de envio que o Setor de quem chama define para o Contato; o canal vem do Contato.
  definir(clienteId: string, contatoId: string, tipos: string[]): Promise<Result<void, AppError>>;
}
