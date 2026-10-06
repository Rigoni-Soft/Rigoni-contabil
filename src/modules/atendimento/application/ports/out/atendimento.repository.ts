import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

export type FuncionarioDoSetor = { id: string; atendimentosNoMes: number; livre: boolean };

export type AutorMensagem = "contato" | "ura" | "funcionario";
export type NovaMensagem = { autor: AutorMensagem; texto: string };

export type NovoAtendimento = {
  telefone: string;
  clienteId: string | null;
  setor: SetorSlug;
  funcionarioId: string | null;
  mensagens: NovaMensagem[];
};

export interface AtendimentoRepositoryPort {
  funcionariosDoSetor(setor: SetorSlug): Promise<Result<FuncionarioDoSetor[], AppError>>;
  // null = o Funcionário escolhido foi ocupado por outro Atendimento no meio (concorrência):
  // nada é gravado e quem chama escolhe de novo.
  abrir(atendimento: NovoAtendimento): Promise<Result<{ id: string } | null, AppError>>;
}
