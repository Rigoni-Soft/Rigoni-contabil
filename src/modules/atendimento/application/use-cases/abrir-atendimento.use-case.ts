import type {
  AberturaAtendimento,
  AbrirAtendimentoPort,
} from "@/modules/atendimento/application/ports/in/abrir-atendimento.provider";
import type { AtendimentoRepositoryPort } from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { AppError } from "@/shared/errors/app.error";
import { err, ok, type Result } from "@/shared/kernel/result";

// Só Atendimento com Funcionário humano conta pro Balanceamento mensal: a contagem vem
// dos Atendimentos já atribuídos, a URA sozinha nunca aparece nela.
// ponytail: "livre" = sem Atendimento em andamento (decidido no gateway); a regra fina de
// disponibilidade/presença e a Fila entram no #45.
export class AbrirAtendimento implements AbrirAtendimentoPort {
  constructor(private readonly atendimentos: AtendimentoRepositoryPort) {}

  async execute(
    abertura: AberturaAtendimento,
  ): Promise<Result<{ id: string; funcionarioId: string | null }, AppError>> {
    const funcionarios = await this.atendimentos.funcionariosDoSetor(abertura.setor);
    if (!funcionarios.ok) return funcionarios;

    // Menos Atendimentos no mês primeiro; empate fica com a ordem devolvida (estável).
    const escolhido = funcionarios.value
      .filter((f) => f.livre)
      .reduce<(typeof funcionarios.value)[number] | null>(
        (melhor, f) => (!melhor || f.atendimentosNoMes < melhor.atendimentosNoMes ? f : melhor),
        null,
      );
    const funcionarioId = escolhido?.id ?? null;

    const aberto = await this.atendimentos.abrir({ ...abertura, funcionarioId });
    if (!aberto.ok) return err(aberto.error);
    return ok({ id: aberto.value.id, funcionarioId });
  }
}
