import type {
  CadastroOperacionalClienteDto,
  ClienteQueryPort,
} from "@/modules/clientes/application/ports/out/cliente-query.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Sem checagem de papel/setor: qualquer usuário com sessão válida visualiza
// (critério de aceite do #34, "Outros Setores conseguem visualizar"). RLS de
// SELECT (defesa em profundidade) já garante que só quem tem perfil vê algo.
export class ConsultarCadastroOperacionalCliente {
  constructor(private readonly query: ClienteQueryPort) {}

  async execute(
    clienteId: string,
  ): Promise<Result<CadastroOperacionalClienteDto | null, AppError>> {
    return this.query.buscarCadastroOperacional(clienteId);
  }
}
