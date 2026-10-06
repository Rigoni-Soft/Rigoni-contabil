import type {
  AberturaAtendimento,
  AbrirAtendimentoPort,
  AtendimentoAberto,
} from "@/modules/atendimento/application/ports/in/abrir-atendimento.provider";
import type {
  AtendimentoRepositoryPort,
  FuncionarioDoSetor,
} from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { AppError } from "@/shared/errors/app.error";
import { ok, type Result } from "@/shared/kernel/result";

const TENTATIVAS = 3;

// Menos Atendimentos no mês primeiro; empate fica com a ordem devolvida (estável).
function menosCarregado(funcionarios: FuncionarioDoSetor[]): FuncionarioDoSetor | null {
  return funcionarios
    .filter((f) => f.livre)
    .reduce<FuncionarioDoSetor | null>(
      (melhor, f) => (!melhor || f.atendimentosNoMes < melhor.atendimentosNoMes ? f : melhor),
      null,
    );
}

// Só Atendimento com Funcionário humano conta pro Balanceamento mensal: a contagem vem
// dos Atendimentos já atribuídos, a URA sozinha nunca aparece nela.
// ponytail: "livre" = sem Atendimento em andamento (decidido no repositório); a regra fina de
// disponibilidade/presença e a Fila entram no #45.
export class AbrirAtendimento implements AbrirAtendimentoPort {
  constructor(private readonly atendimentos: AtendimentoRepositoryPort) {}

  async execute(abertura: AberturaAtendimento): Promise<Result<AtendimentoAberto, AppError>> {
    // O repositório recusa (null) se outro Atendimento ocupou o escolhido entre a listagem e a
    // gravação; relista e escolhe de novo. Esgotadas as tentativas, abre sem atribuição.
    for (let tentativa = 0; tentativa <= TENTATIVAS; tentativa++) {
      let funcionarioId: string | null = null;
      if (tentativa < TENTATIVAS) {
        const funcionarios = await this.atendimentos.funcionariosDoSetor(abertura.setor);
        if (!funcionarios.ok) return funcionarios;
        funcionarioId = menosCarregado(funcionarios.value)?.id ?? null;
      }
      const aberto = await this.atendimentos.abrir({ ...abertura, funcionarioId });
      if (!aberto.ok) return aberto;
      if (aberto.value) return ok({ id: aberto.value.id, funcionarioId });
    }
    throw new Error("inalcançável: abrir sem Funcionário nunca devolve null");
  }
}
