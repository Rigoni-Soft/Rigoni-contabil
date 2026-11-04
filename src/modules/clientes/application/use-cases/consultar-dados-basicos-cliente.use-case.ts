import type {
  ClienteQueryPort,
  DadosBasicosClienteDto,
} from "@/modules/clientes/application/ports/out/cliente-query.provider";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { soLeDadosBasicosDoCliente } from "@/shared/kernel/papeis";
import { err, type Result } from "@/shared/kernel/result";

// Para o Setor que só vê os dados básicos: o cadastro operacional nem chega ao servidor da página.
export class ConsultarDadosBasicosCliente {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly query: ClienteQueryPort,
  ) {}

  async execute(clienteId: string): Promise<Result<DadosBasicosClienteDto | null, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator) return err(new ForbiddenError("Faça login para visualizar o cliente."));
    if (!soLeDadosBasicosDoCliente(ator.papel, ator.setor)) {
      return err(new ForbiddenError("Este perfil vê o cadastro completo do cliente."));
    }
    return this.query.buscarDadosBasicos(clienteId);
  }
}
