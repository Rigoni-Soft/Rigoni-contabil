import type { RemoverFeriadoPort } from "@/modules/atendimento/application/ports/in/gerenciar-feriados.provider";
import type { FeriadoRepositoryPort } from "@/modules/atendimento/application/ports/out/feriado.repository";
import type { SessaoPort } from "@/modules/atendimento/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, type Result } from "@/shared/kernel/result";

// A auditoria (`feriado.remover`) nasce no banco, na mesma transação do DELETE.
export class RemoverFeriado implements RemoverFeriadoPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly feriados: FeriadoRepositoryPort,
  ) {}

  async execute({ data }: { data: string }): Promise<Result<void, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (ator?.papel !== "admin") return err(new ForbiddenError("Só o Admin remove feriados."));
    return this.feriados.remover(data);
  }
}
