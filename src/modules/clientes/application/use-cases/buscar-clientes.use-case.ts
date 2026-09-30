import type {
  ClienteQueryPort,
  SugestaoClienteDto,
} from "@/modules/clientes/application/ports/out/cliente-query.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Sem checagem de papel/setor: qualquer usuário com sessão válida busca (mesma
// regra do #34 pra ConsultarCadastroOperacionalCliente). RLS de SELECT (defesa
// em profundidade) já garante que só quem tem perfil vê algo.
export class BuscarClientes {
  constructor(private readonly query: ClienteQueryPort) {}

  async execute(termo: string): Promise<Result<SugestaoClienteDto[], AppError>> {
    return this.query.buscarPorTermo(termo);
  }
}
