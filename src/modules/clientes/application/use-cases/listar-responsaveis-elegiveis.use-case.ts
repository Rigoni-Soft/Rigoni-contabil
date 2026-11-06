import type {
  ClienteQueryPort,
  ResponsavelOpcaoDto,
} from "@/modules/clientes/application/ports/out/cliente-query.provider";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { podeAtribuirResponsavel } from "@/shared/kernel/papeis";
import { err, type Result } from "@/shared/kernel/result";
import { ehSetor } from "@/shared/kernel/setores";

// A lista serve ao campo Responsável, que é só do Líder do Setor (os Funcionários do próprio
// Setor); a RLS de `perfis` (mesmo Setor) fica como segunda camada.
export class ListarResponsaveisElegiveis {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly query: ClienteQueryPort,
  ) {}

  async execute(): Promise<Result<ResponsavelOpcaoDto[], AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator) return err(new ForbiddenError("Sessão inválida. Entre novamente."));
    if (!ehSetor(ator.setor) || !podeAtribuirResponsavel(ator.papel, ator.setor)) {
      return err(new ForbiddenError("Só o Líder do Setor escolhe o Responsável."));
    }
    return this.query.listarResponsaveisElegiveis(ator.setor);
  }
}
