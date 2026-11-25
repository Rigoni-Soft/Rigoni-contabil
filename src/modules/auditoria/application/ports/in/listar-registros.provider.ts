import type { RegistroAcaoDto } from "@/modules/auditoria/application/dtos/registro-acao.dto";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type ListarRegistrosInput = {
  setor?: string;
  ator?: string;
  acao?: string;
  alvo?: string;
  resultado?: string;
  dataInicio?: string;
  dataFim?: string;
};

export interface ListarRegistrosPort {
  execute(input?: ListarRegistrosInput): Promise<Result<RegistroAcaoDto[], AppError>>;
}
