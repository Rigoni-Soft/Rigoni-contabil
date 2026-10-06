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
import { EstadoInconsistenteError } from "@/shared/errors/estado-inconsistente.error";
import { err, ok, type Result } from "@/shared/kernel/result";

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
  constructor(private readonly repositorio: AtendimentoRepositoryPort) {}

  async execute(abertura: AberturaAtendimento): Promise<Result<AtendimentoAberto, AppError>> {
    // O repositório recusa (null) se outro Atendimento ocupou o escolhido entre a listagem e a
    // gravação; relista e escolhe de novo. Esgotadas as tentativas, abre sem atribuição.
    for (let tentativa = 0; tentativa < TENTATIVAS; tentativa++) {
      const funcionarios = await this.repositorio.funcionariosDoSetor(abertura.setor);
      if (!funcionarios.ok) return funcionarios;
      const funcionarioId = menosCarregado(funcionarios.value)?.id ?? null;
      const aberto = await this.repositorio.abrir({ ...abertura, funcionarioId });
      if (!aberto.ok) return aberto;
      if (aberto.value.status === "aberto") return ok({ id: aberto.value.id, funcionarioId });
    }
    const semAtribuicao = await this.repositorio.abrir({ ...abertura, funcionarioId: null });
    if (!semAtribuicao.ok) return semAtribuicao;
    // Sem Funcionário não há o que disputar: "conflito" aqui quebra o contrato do repositório.
    if (semAtribuicao.value.status !== "aberto") {
      return err(
        new EstadoInconsistenteError(
          "Repositório recusou abrir Atendimento sem Funcionário.",
          abertura.chave,
        ),
      );
    }
    return ok({ id: semAtribuicao.value.id, funcionarioId: null });
  }
}
