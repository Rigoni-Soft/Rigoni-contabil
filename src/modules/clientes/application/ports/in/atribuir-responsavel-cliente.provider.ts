import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// responsavelId null = remover o Responsável ("Sem responsável").
export type AtribuirResponsavelClienteInput = { clienteId: string; responsavelId: string | null };

export type AtribuirResponsavelClienteOutput = { clienteId: string };

export interface AtribuirResponsavelClientePort {
  execute(
    input: AtribuirResponsavelClienteInput,
  ): Promise<Result<AtribuirResponsavelClienteOutput, AppError>>;
}
