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
  // ISO 8601 completo (não yyyy-mm-dd): o caso de uso já resolve o dia inteiro.
  dataInicio?: string;
  dataFim?: string;
};

export interface RegistroAcaoRepository {
  salvar(registro: RegistroAcao): Promise<Result<void, AppError>>;
  // Read model (testes.md, seção 3.6): DTOs de leitura direto, sem reconstruir entidade.
  listar(filtro: RegistroAcaoFiltro): Promise<Result<RegistroAcaoDto[], AppError>>;
}
