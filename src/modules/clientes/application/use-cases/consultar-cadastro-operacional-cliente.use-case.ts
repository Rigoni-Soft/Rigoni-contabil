import type {
  CadastroOperacionalClienteDto,
  ClienteQueryPort,
} from "@/modules/clientes/application/ports/out/cliente-query.provider";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { usaCadastroDoRh } from "@/shared/kernel/papeis";
import { err, type Result } from "@/shared/kernel/result";

export class ConsultarCadastroOperacionalCliente {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly query: ClienteQueryPort,
  ) {}

  async execute(
    clienteId: string,
  ): Promise<Result<CadastroOperacionalClienteDto | null, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator) return err(new ForbiddenError("Faça login para visualizar o cadastro."));
    if (usaCadastroDoRh(ator.papel, ator.setor)) {
      return err(new ForbiddenError("Este perfil usa o cadastro do RH."));
    }
    return this.query.buscarCadastroOperacional(clienteId);
  }
}
