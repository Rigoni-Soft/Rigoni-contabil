import type { FeriadoDto } from "@/modules/atendimento/application/dtos/feriado.dto";
import type { ListarFeriadosPort } from "@/modules/atendimento/application/ports/in/gerenciar-feriados.provider";
import type { FeriadoRepositoryPort } from "@/modules/atendimento/application/ports/out/feriado.repository";
import type { SessaoPort } from "@/modules/atendimento/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, type Result } from "@/shared/kernel/result";

export class ListarFeriados implements ListarFeriadosPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly feriados: FeriadoRepositoryPort,
  ) {}

  async execute(): Promise<Result<FeriadoDto[], AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (ator?.papel !== "admin") return err(new ForbiddenError("Só o Admin vê os feriados."));
    return this.feriados.listar();
  }
}
