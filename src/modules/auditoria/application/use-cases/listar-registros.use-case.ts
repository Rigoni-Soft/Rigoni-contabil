import type { RegistroAcaoDto } from "@/modules/auditoria/application/dtos/registro-acao.dto";
import type { ListarRegistrosPort } from "@/modules/auditoria/application/ports/in/listar-registros.provider";
import type { RegistroAcaoRepository } from "@/modules/auditoria/application/ports/out/registro-acao.repository";
import type { SessaoPort } from "@/modules/auditoria/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok, type Result } from "@/shared/kernel/result";

const LIMITE_FEED = 50;

export class ListarRegistros implements ListarRegistrosPort {
  constructor(
    private readonly registros: RegistroAcaoRepository,
    private readonly sessao: SessaoPort,
  ) {}

  async execute(): Promise<Result<RegistroAcaoDto[], AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator || ator.papel !== "admin") {
      return err(new ForbiddenError("Só Admin acessa o feed de auditoria."));
    }

    return ok(await this.registros.listarRecentes(LIMITE_FEED));
  }
}
