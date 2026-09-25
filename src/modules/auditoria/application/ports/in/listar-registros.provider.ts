import type { RegistroAcaoDto } from "@/modules/auditoria/application/dtos/registro-acao.dto";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export interface ListarRegistrosPort {
  execute(): Promise<Result<RegistroAcaoDto[], AppError>>;
}
