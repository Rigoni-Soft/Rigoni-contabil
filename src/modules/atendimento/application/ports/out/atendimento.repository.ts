import type {
  AberturaAtendimento,
  NovaMensagem,
} from "@/modules/atendimento/application/ports/in/abrir-atendimento.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

export type FuncionarioDoSetor = { id: string; atendimentosNoMes: number; livre: boolean };

// "conflito": o Funcionário escolhido foi ocupado por outro Atendimento no meio (concorrência);
// nada é gravado e quem chama escolhe de novo.
export type ResultadoAbertura = { status: "aberto"; id: string } | { status: "conflito" };
export type ResultadoAnexo = { status: "anexada" } | { status: "sem_atendimento" };

export type NovoAtendimento = AberturaAtendimento & { funcionarioId: string | null };

export interface AtendimentoRepositoryPort {
  funcionariosDoSetor(setor: SetorSlug): Promise<Result<FuncionarioDoSetor[], AppError>>;
  abrir(atendimento: NovoAtendimento): Promise<Result<ResultadoAbertura, AppError>>;
  anexarMensagem(chave: string, mensagem: NovaMensagem): Promise<Result<ResultadoAnexo, AppError>>;
}
