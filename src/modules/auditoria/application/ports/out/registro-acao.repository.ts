import type { RegistroAcaoDto } from "@/modules/auditoria/application/dtos/registro-acao.dto";
import type { RegistroAcao } from "@/modules/auditoria/domain/entities/registro-acao.entity";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type RegistroAcaoFiltro = {
  limite: number;
  setor?: string;
  ator?: string;
  acao?: string;
  alvo?: string;
  resultado?: string;
  dataInicio?: string;
  dataFim?: string;
};

export interface RegistroAcaoRepository {
  salvar(registro: RegistroAcao): Promise<Result<void, AppError>>;
  listar(filtro: RegistroAcaoFiltro): Promise<Result<RegistroAcaoDto[], AppError>>;
}
