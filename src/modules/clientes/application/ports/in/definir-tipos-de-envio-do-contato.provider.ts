import type { AppError } from "@/shared/errors/app.error";
import type { FormaEnvioValor } from "@/shared/kernel/forma-envio";
import type { Result } from "@/shared/kernel/result";

export type DefinirTiposDeEnvioDoContatoInput = {
  clienteId: string;
  contatoId: string;
  tipos: string[];
  canal?: FormaEnvioValor;
};

export interface DefinirTiposDeEnvioDoContatoPort {
  execute(input: DefinirTiposDeEnvioDoContatoInput): Promise<Result<void, AppError>>;
}
