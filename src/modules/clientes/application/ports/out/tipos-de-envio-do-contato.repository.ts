import type { AppError } from "@/shared/errors/app.error";
import type { FormaEnvioValor } from "@/shared/kernel/forma-envio";
import type { Result } from "@/shared/kernel/result";

export interface TiposDeEnvioDoContatoRepository {
  definir(
    clienteId: string,
    contatoId: string,
    tipos: string[],
    canal?: FormaEnvioValor,
  ): Promise<Result<void, AppError>>;
}
