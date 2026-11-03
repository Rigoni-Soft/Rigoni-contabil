import { calcularComparativosSn } from "@/modules/clientes/application/mappers/comparativos-sn.mapper";
import {
  classificarResumoSetorSn,
  gruposDoResumoSn,
} from "@/modules/clientes/application/mappers/resumo-setor-sn.mapper";
import type { ResumoSetorSnDto } from "@/modules/clientes/application/ports/in/obter-resumo-setor-sn.provider";
import type { ClienteQueryPort } from "@/modules/clientes/application/ports/out/cliente-query.provider";
import type { RelogioPort } from "@/modules/clientes/application/ports/out/relogio.provider";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { podeAtribuirResponsavel, podeVerDashboardDoSetor } from "@/shared/kernel/papeis";
import { err, ok, type Result } from "@/shared/kernel/result";

// O resumo é do Setor Simples Nacional: Admin entra para suporte, Líder e Funcionário só do
// Simples Nacional (`podeVerDashboardDoSetor`). A sessão e o acesso são validados antes de consultar
// (arquitetura.md §3.12), com a RLS de SELECT como segunda camada; as páginas também redirecionam,
// mas deixaram de ser a única barreira. O 4º comparativo é só do Líder do Simples Nacional.
export class ObterResumoSetorSn {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly query: ClienteQueryPort,
    private readonly relogio: RelogioPort,
  ) {}

  async execute(): Promise<Result<ResumoSetorSnDto, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator) return err(new ForbiddenError("Faça login para ver o resumo do setor."));
    if (!podeVerDashboardDoSetor(ator.papel, ator.setor, "simples_nacional")) {
      return err(new ForbiddenError("Só o Simples Nacional (e o Admin) vê o resumo do setor."));
    }

    const linhas = await this.query.listarResumoOperacional();
    if (!linhas.ok) return linhas;

    // Um só instante para cards e comparativos: o "pendente em atraso" depende do dia (São Paulo).
    const agora = this.relogio.agora();
    const { responsaveis, ...comparativos } = calcularComparativosSn(linhas.value, agora);

    return ok({
      totalClientes: linhas.value.length,
      cards: classificarResumoSetorSn(linhas.value, agora),
      grupos: gruposDoResumoSn(),
      comparativos: podeAtribuirResponsavel(ator.papel, ator.setor)
        ? { ...comparativos, responsaveis }
        : comparativos,
    });
  }
}
