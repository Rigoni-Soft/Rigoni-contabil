import type {
  ClienteQueryPort,
  ResponsavelOpcaoDto,
} from "@/modules/clientes/application/ports/out/cliente-query.provider";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, type Result } from "@/shared/kernel/result";

// Leitura: exige só sessão válida (RLS de `perfis` já limita ao mesmo Setor).
// A UI chama quando o Líder abre o campo Responsável (#65).
export class ListarResponsaveisElegiveis {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly query: ClienteQueryPort,
  ) {}

  async execute(): Promise<Result<ResponsavelOpcaoDto[], AppError>> {
    if (!(await this.sessao.usuarioAtual())) {
      return err(new ForbiddenError("Sessão inválida. Entre novamente."));
    }
    return this.query.listarResponsaveisElegiveis();
  }
}
