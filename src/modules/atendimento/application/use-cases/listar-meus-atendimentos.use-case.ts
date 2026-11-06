import type {
  AtendimentoVisto,
  ListarMeusAtendimentosPort,
} from "@/modules/atendimento/application/ports/in/listar-meus-atendimentos.provider";
import type { AtendimentoRepositoryPort } from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { SessaoPort } from "@/modules/atendimento/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok, type Result } from "@/shared/kernel/result";

export class ListarMeusAtendimentos implements ListarMeusAtendimentosPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly repositorio: AtendimentoRepositoryPort,
  ) {}

  async execute(): Promise<Result<AtendimentoVisto[], AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator) return err(new ForbiddenError("Faça login para ver seus Atendimentos."));

    const atendimentos = await this.repositorio.emAndamentoDoFuncionario(ator.id);
    if (!atendimentos.ok) return atendimentos;
    return ok(
      atendimentos.value.map((a) => ({
        atendimentoId: a.id,
        telefone: a.telefone,
        criadoEm: a.criadoEm,
        contato: a.contato,
        ultimaMensagem: a.ultimaMensagem,
      })),
    );
  }
}
