import type { AssumirAtendimentoPort } from "@/modules/atendimento/application/ports/in/assumir-atendimento.provider";
import type { AtendimentoRepositoryPort } from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { SessaoPort } from "@/modules/atendimento/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ConflictError } from "@/shared/errors/conflict.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import { err, ok, type Result } from "@/shared/kernel/result";

const ERRO_POR_STATUS = {
  ja_assumido: () => new ConflictError("Atendimento já assumido por outra pessoa."),
  inelegivel: () => new ForbiddenError("Você não pode assumir Atendimentos deste Setor."),
  inexistente: () => new NotFoundError("Atendimento não encontrado ou já encerrado."),
};

// Qualquer usuário ativo do Setor assume, sem teto de simultâneos. Quem decide a corrida e a
// elegibilidade é o banco (atômico, no perfil real); aqui só se traduz o resultado.
export class AssumirAtendimento implements AssumirAtendimentoPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly repositorio: AtendimentoRepositoryPort,
  ) {}

  async execute({ atendimentoId }: { atendimentoId: string }): Promise<Result<void, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator) return err(new ForbiddenError("Faça login para assumir o Atendimento."));

    const assuncao = await this.repositorio.assumir(atendimentoId, ator.id);
    if (!assuncao.ok) return assuncao;

    const status = assuncao.value.status;
    return status === "assumido" ? ok(undefined) : err(ERRO_POR_STATUS[status]());
  }
}
