import type {
  RemoverDestinoDeEnvioInput,
  RemoverDestinoDeEnvioPort,
} from "@/modules/clientes/application/ports/in/remover-destino-de-envio.provider";
import type { DestinoDeEnvioRepository } from "@/modules/clientes/application/ports/out/destino-de-envio.repository";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, type Result } from "@/shared/kernel/result";

// Quem pode remover o Destino (o Setor dele, por Cliente) o banco confere; aqui só se exige sessão.
export class RemoverDestinoDeEnvio implements RemoverDestinoDeEnvioPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly repositorio: DestinoDeEnvioRepository,
  ) {}

  async execute(input: RemoverDestinoDeEnvioInput): Promise<Result<void, AppError>> {
    if (!(await this.sessao.usuarioAtual())) {
      return err(new ForbiddenError("Entre para remover o destino."));
    }
    return this.repositorio.remover(input.destinoId);
  }
}
