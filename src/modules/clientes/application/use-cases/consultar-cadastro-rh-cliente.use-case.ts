import type {
  CadastroRhClienteDto,
  ClienteQueryPort,
} from "@/modules/clientes/application/ports/out/cliente-query.provider";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { usaCadastroDoRh } from "@/shared/kernel/papeis";
import { err, type Result } from "@/shared/kernel/result";

// O cadastro do Cliente no RH: o do SN (DAS, atividade, forma de envio) nem chega ao servidor da página.
export class ConsultarCadastroRhCliente {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly query: ClienteQueryPort,
  ) {}

  async execute(clienteId: string): Promise<Result<CadastroRhClienteDto | null, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator) return err(new ForbiddenError("Faça login para visualizar o cliente."));
    // O Admin lê também (as observações do RH aparecem na tela completa dele).
    if (ator.papel !== "admin" && !usaCadastroDoRh(ator.papel, ator.setor)) {
      return err(new ForbiddenError("Este perfil vê o cadastro completo do cliente."));
    }
    return this.query.buscarCadastroRh(clienteId);
  }
}
