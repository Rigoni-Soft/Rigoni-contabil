import { classificarResumoSetorSn } from "@/modules/clientes/application/mappers/resumo-setor-sn.mapper";
import type { ResumoSetorSnDto } from "@/modules/clientes/application/ports/in/obter-resumo-setor-sn.provider";
import type { ClienteQueryPort } from "@/modules/clientes/application/ports/out/cliente-query.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ok, type Result } from "@/shared/kernel/result";

// Sem checagem de papel/setor, mesmo raciocínio do ConsultarCadastroOperacionalCliente
// (#34): o resumo é visualização, RLS de SELECT já restringe a quem tem perfil.
export class ObterResumoSetorSn {
  constructor(private readonly query: ClienteQueryPort) {}

  async execute(): Promise<Result<ResumoSetorSnDto, AppError>> {
    const linhas = await this.query.listarResumoOperacional();
    if (!linhas.ok) return linhas;

    return ok({
      totalClientes: linhas.value.length,
      cards: classificarResumoSetorSn(linhas.value),
    });
  }
}
