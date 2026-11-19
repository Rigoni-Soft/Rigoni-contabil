import type {
  DefinirDestinoDeEnvioInput,
  DefinirDestinoDeEnvioPort,
} from "@/modules/clientes/application/ports/in/definir-destino-de-envio.provider";
import type { DestinoDeEnvioRepository } from "@/modules/clientes/application/ports/out/destino-de-envio.repository";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import { DestinoDeEnvio } from "@/modules/clientes/domain/value-objects/destino-de-envio.vo";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, type Result } from "@/shared/kernel/result";

// O Destino é sempre do Setor de quem chama; o Admin não tem Setor, então não define Destinos (o banco
// confere isso e a permissão por Cliente). Aqui se exige sessão e se valida o que o Setor definiu.
export class DefinirDestinoDeEnvio implements DefinirDestinoDeEnvioPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly repositorio: DestinoDeEnvioRepository,
  ) {}

  async execute(
    input: DefinirDestinoDeEnvioInput,
  ): Promise<Result<{ destinoId: string; contatoId: string }, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator || ator.papel === "admin") {
      return err(new ForbiddenError("Só um Setor define os destinos de envio do Cliente."));
    }
    const destino = DestinoDeEnvio.criar(input);
    if (!destino.ok) return destino;
    return this.repositorio.definir(input.clienteId, destino.value);
  }
}
