import type {
  AtendimentoDaEquipeVisto,
  ListarAtendimentosDaEquipePort,
} from "@/modules/atendimento/application/ports/in/listar-atendimentos-da-equipe.provider";
import type { AtendimentoRepositoryPort } from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { SessaoPort } from "@/modules/atendimento/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok, type Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

export class ListarAtendimentosDaEquipe implements ListarAtendimentosDaEquipePort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly repositorio: AtendimentoRepositoryPort,
  ) {}

  async execute(input: {
    setor?: SetorSlug;
  }): Promise<Result<AtendimentoDaEquipeVisto[], AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator) return err(new ForbiddenError("Faça login para ver os Atendimentos da equipe."));
    if (ator.papel === "funcionario") {
      return err(new ForbiddenError("Só Líder e Admin supervisionam os Atendimentos da equipe."));
    }
    if (!input.setor && ator.papel === "admin") {
      return err(new ForbiddenError("Informe o Setor."));
    }
    const setor = input.setor ?? ator.setor;
    if (ator.papel !== "admin" && ator.setor !== setor) {
      return err(new ForbiddenError("Você só supervisiona o seu Setor."));
    }

    const atendimentos = await this.repositorio.emAndamentoDoSetor(setor);
    if (!atendimentos.ok) return atendimentos;
    // Os do próprio usuário já estão na aba dele.
    return ok(
      atendimentos.value
        .filter((a) => a.funcionarioId !== ator.id)
        .map((a) => ({
          atendimentoId: a.id,
          telefone: a.telefone,
          criadoEm: a.criadoEm,
          contato: a.contato,
          ultimaMensagem: a.ultimaMensagem,
          donoNome: a.funcionarioNome,
        })),
    );
  }
}
