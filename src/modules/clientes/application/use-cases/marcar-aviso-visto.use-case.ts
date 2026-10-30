import type { MarcarAvisoVistoPort } from "@/modules/clientes/application/ports/in/marcar-aviso-visto.provider";
import type { AvisosCadastroPort } from "@/modules/clientes/application/ports/out/avisos-cadastro.provider";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, type Result } from "@/shared/kernel/result";

// Idempotente e restrito aos próprios avisos no banco (RPC): marcar de novo ou o de outra pessoa não muda nada.
export class MarcarAvisoVisto implements MarcarAvisoVistoPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly avisos: AvisosCadastroPort,
  ) {}

  async execute(avisoId: string): Promise<Result<void, AppError>> {
    if (!(await this.sessao.usuarioAtual())) {
      return err(new ForbiddenError("Faça login para marcar o aviso."));
    }
    return this.avisos.marcarVisto(avisoId);
  }
}
