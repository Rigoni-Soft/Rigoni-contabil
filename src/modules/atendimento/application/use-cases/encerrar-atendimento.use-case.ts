import type {
  AtendimentoEncerrado,
  EncerrarAtendimentoPort,
} from "@/modules/atendimento/application/ports/in/encerrar-atendimento.provider";
import type { PromoverDaFilaPort } from "@/modules/atendimento/application/ports/in/promover-da-fila.provider";
import type { AtendimentoRepositoryPort } from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { SessaoPort } from "@/modules/atendimento/application/ports/out/sessao.provider";
import { podeTransferir } from "@/modules/atendimento/domain/services/transferencia.service";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import { err, ok, type Result } from "@/shared/kernel/result";

// Encerrar libera o Funcionário: o cliente mais antigo da Fila assume o lugar. Mesma regra de
// quem pode agir sobre o Atendimento que a Transferência (dono, Líder do Setor ou Admin).
export class EncerrarAtendimento implements EncerrarAtendimentoPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly repositorio: AtendimentoRepositoryPort,
    private readonly fila: PromoverDaFilaPort,
  ) {}

  async execute({
    atendimentoId,
  }: {
    atendimentoId: string;
  }): Promise<Result<AtendimentoEncerrado, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator) return err(new ForbiddenError("Faça login para encerrar o Atendimento."));

    const encontrado = await this.repositorio.buscarEmAndamento(atendimentoId);
    if (!encontrado.ok) return encontrado;
    const atendimento = encontrado.value;
    if (!atendimento) return err(new NotFoundError("Atendimento não encontrado."));
    if (!podeTransferir(ator, atendimento)) {
      return err(new ForbiddenError("Você não pode encerrar este Atendimento."));
    }

    const encerrado = await this.repositorio.encerrar(atendimentoId, atendimento.funcionarioId, {
      id: ator.id,
      setor: ator.setor,
    });
    if (!encerrado.ok) return encerrado;
    if (!encerrado.value) {
      return err(
        new NotFoundError("O Atendimento mudou ou foi encerrado. Atualize e tente novamente."),
      );
    }
    if (!atendimento.funcionarioId) return ok({ proximoDaFila: null });

    const proximo = await this.fila.execute({
      funcionarioId: atendimento.funcionarioId,
      setor: atendimento.setor,
    });
    return proximo.ok ? ok({ proximoDaFila: proximo.value?.atendimentoId ?? null }) : proximo;
  }
}
