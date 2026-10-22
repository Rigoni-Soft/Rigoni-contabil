import type { ContarAvisosNaoVistosPort } from "@/modules/clientes/application/ports/in/avisos-cadastro.provider";
import type { AvisosCadastroPort } from "@/modules/clientes/application/ports/out/avisos-cadastro.provider";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, type Result } from "@/shared/kernel/result";

export class ContarAvisosNaoVistos implements ContarAvisosNaoVistosPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly avisos: AvisosCadastroPort,
  ) {}

  async execute(): Promise<Result<number, AppError>> {
    if (!(await this.sessao.usuarioAtual())) {
      return err(new ForbiddenError("Faça login para ver os avisos."));
    }
    return this.avisos.contarNaoVistos();
  }
}
