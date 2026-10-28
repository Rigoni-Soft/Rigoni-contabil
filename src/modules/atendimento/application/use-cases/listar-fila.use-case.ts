import type {
  ItemDaFilaVisto,
  ListarFilaPort,
} from "@/modules/atendimento/application/ports/in/listar-fila.provider";
import type { AtendimentoRepositoryPort } from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { RelogioPort } from "@/modules/atendimento/application/ports/out/relogio.provider";
import type { SessaoPort } from "@/modules/atendimento/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { formatarEspera } from "@/shared/kernel/espera";
import { err, ok, type Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

// O Setor vê a própria Fila (Admin vê a de qualquer Setor).
export class ListarFila implements ListarFilaPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly repositorio: AtendimentoRepositoryPort,
    private readonly relogio: RelogioPort,
  ) {}

  async execute(input: { setor?: SetorSlug }): Promise<Result<ItemDaFilaVisto[], AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator) return err(new ForbiddenError("Faça login para ver a Fila."));
    if (!input.setor && ator.papel === "admin") {
      return err(new ForbiddenError("Informe o Setor da Fila."));
    }
    const setor = input.setor ?? ator.setor;
    if (ator.papel !== "admin" && ator.setor !== setor) {
      return err(new ForbiddenError("Você só vê a Fila do seu Setor."));
    }

    const fila = await this.repositorio.filaDoSetor(setor);
    if (!fila.ok) return fila;
    const agora = this.relogio.agora().getTime();
    // Só o destinatário vê o Atendimento (Líder e Admin leem em supervisão). A espera comum, sem
    // destinatário, existe só na Recepção: onde ela não é a Recepção, o Atendimento sem Responsável
    // nem Líder fica só para a supervisão. Os outros usuários nem recebem o Atendimento.
    const supervisiona = ator.papel === "admin" || ator.papel === "lider_setor";
    const esperaComum = setor === "recepcao";
    const visiveis = fila.value.filter((item) =>
      item.filaFuncionarioId === null
        ? supervisiona || esperaComum
        : supervisiona || item.filaFuncionarioId === ator.id,
    );
    return ok(
      visiveis.map((item) => ({
        atendimentoId: item.id,
        telefone: item.telefone,
        contato: item.contato,
        resumo: item.resumo,
        origem: item.origem,
        filaDesde: item.filaDesde,
        espera: formatarEspera(agora - item.filaDesde.getTime()),
        filaDoFuncionarioId: item.filaFuncionarioId,
      })),
    );
  }
}
