import type { FeriadoDto } from "@/modules/atendimento/application/dtos/feriado.dto";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Feriados estaduais/municipais: só o Admin lê, cadastra e remove.
export interface ListarFeriadosPort {
  execute(): Promise<Result<FeriadoDto[], AppError>>;
}

export interface CadastrarFeriadoPort {
  execute(input: FeriadoDto): Promise<Result<void, AppError>>;
}

export interface RemoverFeriadoPort {
  execute(input: { data: string }): Promise<Result<void, AppError>>;
}
