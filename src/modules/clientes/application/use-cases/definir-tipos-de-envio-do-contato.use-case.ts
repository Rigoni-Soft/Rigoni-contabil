import type {
  DefinirTiposDeEnvioDoContatoInput,
  DefinirTiposDeEnvioDoContatoPort,
} from "@/modules/clientes/application/ports/in/definir-tipos-de-envio-do-contato.provider";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import type { TiposDeEnvioDoContatoRepository } from "@/modules/clientes/application/ports/out/tipos-de-envio-do-contato.repository";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, type Result } from "@/shared/kernel/result";

// O Destino é sempre do Setor de quem chama; o Admin não tem Setor, então não define (o banco confere isso,
// a permissão por Cliente e o catálogo do Setor). Aqui se exige sessão e se tiram os tipos repetidos.
export class DefinirTiposDeEnvioDoContato implements DefinirTiposDeEnvioDoContatoPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly repositorio: TiposDeEnvioDoContatoRepository,
  ) {}

  async execute(input: DefinirTiposDeEnvioDoContatoInput): Promise<Result<void, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator || ator.papel === "admin") {
      return err(new ForbiddenError("Só um Setor define os destinos de envio do Cliente."));
    }
    const tipos = [...new Set(input.tipos.map((tipo) => tipo.trim()).filter(Boolean))];
    return this.repositorio.definir(input.clienteId, input.contatoId, tipos, input.canal);
  }
}
