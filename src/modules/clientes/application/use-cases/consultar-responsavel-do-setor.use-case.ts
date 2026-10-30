import type {
  ClienteQueryPort,
  ResponsavelOpcaoDto,
} from "@/modules/clientes/application/ports/out/cliente-query.provider";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { podeAtribuirResponsavel } from "@/shared/kernel/papeis";
import { err, type Result } from "@/shared/kernel/result";
import { ehSetor } from "@/shared/kernel/setores";

// O Responsável atual do Cliente no Setor do Líder, para a tela onde ele o troca. O SN o mostra no
// cadastro operacional; aqui é só o dos demais Setores.
export class ConsultarResponsavelDoSetor {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly query: ClienteQueryPort,
  ) {}

  async execute(clienteId: string): Promise<Result<ResponsavelOpcaoDto | null, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator || !ehSetor(ator.setor) || !podeAtribuirResponsavel(ator.papel, ator.setor)) {
      return err(new ForbiddenError("Só o Líder do Setor vê o Responsável do Setor."));
    }
    return this.query.buscarResponsavelDoSetor(clienteId, ator.setor);
  }
}
