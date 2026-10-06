import type {
  CadastroOperacionalClienteDto,
  ClienteQueryPort,
} from "@/modules/clientes/application/ports/out/cliente-query.provider";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, type Result } from "@/shared/kernel/result";

// Sem checagem de papel/setor: qualquer usuário autenticado visualiza (critério
// de aceite do #34, "Outros Setores conseguem visualizar"). A sessão é validada
// aqui (arquitetura.md §3.12); a RLS fica como segunda camada, não como única.
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
    return this.query.buscarCadastroOperacional(clienteId);
  }
}
