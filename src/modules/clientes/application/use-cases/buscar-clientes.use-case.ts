import type {
  ClienteQueryPort,
  SugestaoClienteDto,
} from "@/modules/clientes/application/ports/out/cliente-query.provider";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, type Result } from "@/shared/kernel/result";

// Sem checagem de papel/setor: qualquer usuário com sessão válida busca (mesma
// regra do #34 pra ConsultarCadastroOperacionalCliente). A sessão é validada aqui
// (arquitetura.md §3.12); a RLS (que também esconde os Clientes dos quais o
// Funcionário SN não é Responsável) fica como segunda camada, não como única.
export class BuscarClientes {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly query: ClienteQueryPort,
  ) {}

  async execute(
    termo: string,
    apenasSnMei: boolean,
  ): Promise<Result<SugestaoClienteDto[], AppError>> {
    if (!(await this.sessao.usuarioAtual())) {
      return err(new ForbiddenError("Faça login para buscar clientes."));
    }
    return this.query.buscarPorTermo(termo, apenasSnMei);
  }
}
