import type { FeriadoDto } from "@/modules/atendimento/application/dtos/feriado.dto";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export interface FeriadoRepositoryPort {
  listar(): Promise<Result<FeriadoDto[], AppError>>;
  cadastrar(feriado: FeriadoDto): Promise<Result<void, AppError>>;
  remover(data: string): Promise<Result<void, AppError>>;
}
