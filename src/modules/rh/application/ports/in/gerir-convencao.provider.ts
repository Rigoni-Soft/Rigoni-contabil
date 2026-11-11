import type { InterruptoresDoClienteDto } from "@/modules/rh/application/dtos/convencao.dto";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type EnviarConvencaoInput = {
  clienteId: string;
  sindicato: string;
  // "AAAA-MM-DD".
  vigenciaInicio: string;
  vigenciaFim: string;
  arquivo: { nome: string; bytes: Uint8Array };
};
export type DefinirInterruptoresDoClienteInput = InterruptoresDoClienteDto & { clienteId: string };
// Sindicato nulo = o empregado volta a seguir a única convenção do Cliente.
export type DefinirConvencaoDoEmpregadoInput = { empregadoId: string; sindicato: string | null };

export interface EnviarConvencaoPort {
  execute(input: EnviarConvencaoInput): Promise<Result<void, AppError>>;
}
export interface DefinirInterruptoresDoClientePort {
  execute(input: DefinirInterruptoresDoClienteInput): Promise<Result<void, AppError>>;
}
export interface DefinirConvencaoDoEmpregadoPort {
  execute(input: DefinirConvencaoDoEmpregadoInput): Promise<Result<void, AppError>>;
}
