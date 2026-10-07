import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// `data` é "AAAA-MM-DD".
export type FeriadoDto = { data: string; descricao: string };

export interface FeriadoRepositoryPort {
  listar(): Promise<Result<FeriadoDto[], AppError>>;
  // ValidationError se a data já tem feriado cadastrado.
  cadastrar(feriado: FeriadoDto): Promise<Result<void, AppError>>;
  // NotFoundError se a data não tem feriado cadastrado.
  remover(data: string): Promise<Result<void, AppError>>;
}
