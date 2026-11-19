import type { AppError } from "@/shared/errors/app.error";
import type { FormaEnvioValor } from "@/shared/kernel/forma-envio";
import type { Result } from "@/shared/kernel/result";

export interface TiposDeEnvioDoContatoRepository {
  // Troca os tipos de envio que o Setor de quem chama define para o Contato. Com um canal só o canal vem do
  // Contato; com os dois, `canal` é obrigatório (o banco recusa sem ele).
  definir(
    clienteId: string,
    contatoId: string,
    tipos: string[],
    canal?: FormaEnvioValor,
  ): Promise<Result<void, AppError>>;
}
