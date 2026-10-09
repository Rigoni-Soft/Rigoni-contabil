import type {
  ItemDaFilaVisto,
  ListarFilaPort,
} from "@/modules/atendimento/application/ports/in/listar-fila.provider";
import type { AtendimentoRepositoryPort } from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { RelogioPort } from "@/modules/atendimento/application/ports/out/relogio.provider";
import type { SessaoPort } from "@/modules/atendimento/application/ports/out/sessao.provider";
import { formatarEspera } from "@/shared/kernel/espera";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok, type Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

// O Setor vê a própria Fila (Admin vê a de qualquer Setor).
export class ListarFila implements ListarFilaPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly repositorio: AtendimentoRepositoryPort,
    private readonly relogio: RelogioPort,
  ) {}

  async execute({ setor }: { setor: SetorSlug }): Promise<Result<ItemDaFilaVisto[], AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator) return err(new ForbiddenError("Faça login para ver a Fila."));
    if (ator.papel !== "admin" && ator.setor !== setor) {
      return err(new ForbiddenError("Você só vê a Fila do seu Setor."));
    }

    const fila = await this.repositorio.filaDoSetor(setor);
    if (!fila.ok) return fila;
    const agora = this.relogio.agora().getTime();
    return ok(
      fila.value.map((item) => ({
        atendimentoId: item.id,
        posicao: item.posicao,
        telefone: item.telefone,
        contato: item.contato,
        resumo: item.resumo,
        filaDesde: item.filaDesde,
        espera: formatarEspera(agora - item.filaDesde.getTime()),
        filaDoFuncionarioId: item.filaFuncionarioId,
      })),
    );
  }
}
