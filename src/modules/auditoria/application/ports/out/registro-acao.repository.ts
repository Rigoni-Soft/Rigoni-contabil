import type { RegistroAcaoDto } from "@/modules/auditoria/application/dtos/registro-acao.dto";
import type { RegistroAcao } from "@/modules/auditoria/domain/entities/registro-acao.entity";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export interface RegistroAcaoRepository {
  salvar(registro: RegistroAcao): Promise<Result<void, AppError>>;
  // Read model (testes.md, seção 3.6): DTOs de leitura direto, sem reconstruir entidade.
  listarRecentes(limite: number): Promise<RegistroAcaoDto[]>;
}
