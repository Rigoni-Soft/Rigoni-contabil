import type {
  CadastroOperacionalClienteDto,
  ClienteQueryPort,
} from "@/modules/clientes/application/ports/out/cliente-query.provider";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { soLeDadosBasicosDoCliente } from "@/shared/kernel/papeis";
import { err, type Result } from "@/shared/kernel/result";

// Qualquer usuário autenticado visualiza o cadastro (outros Setores conseguem visualizar), menos o
// Setor que só lê os dados básicos (RH): esse usa ConsultarDadosBasicosCliente. A sessão e o perfil
// são validados aqui (arquitetura.md §3.12); a RLS fica como segunda camada, não como única.
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
    if (soLeDadosBasicosDoCliente(ator.papel, ator.setor)) {
      return err(new ForbiddenError("Este perfil lê só os dados básicos do cliente."));
    }
    return this.query.buscarCadastroOperacional(clienteId);
  }
}
