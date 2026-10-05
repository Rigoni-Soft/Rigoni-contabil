import { calcularComparativosSn } from "@/modules/clientes/application/mappers/comparativos-sn.mapper";
import { classificarResumoSetorSn } from "@/modules/clientes/application/mappers/resumo-setor-sn.mapper";
import type { ResumoSetorSnDto } from "@/modules/clientes/application/ports/in/obter-resumo-setor-sn.provider";
import type { ClienteQueryPort } from "@/modules/clientes/application/ports/out/cliente-query.provider";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { podeAtribuirResponsavel } from "@/shared/kernel/papeis";
import { ok, type Result } from "@/shared/kernel/result";

// Sem exigir sessão pra ver o resumo, mesmo raciocínio do ConsultarCadastroOperacionalCliente
// (#34): é visualização, RLS de SELECT já restringe a quem tem perfil. A sessão
// só decide o 4º comparativo (#65), que é do Líder do Simples Nacional.
export class ObterResumoSetorSn {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly query: ClienteQueryPort,
  ) {}

  async execute(): Promise<Result<ResumoSetorSnDto, AppError>> {
    const linhas = await this.query.listarResumoOperacional();
    if (!linhas.ok) return linhas;

    const ator = await this.sessao.usuarioAtual();
    const { responsaveis, ...comparativos } = calcularComparativosSn(linhas.value);

    return ok({
      totalClientes: linhas.value.length,
      cards: classificarResumoSetorSn(linhas.value),
      comparativos:
        ator && podeAtribuirResponsavel(ator.papel, ator.setor)
          ? { ...comparativos, responsaveis }
          : comparativos,
    });
  }
}
