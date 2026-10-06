import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type FuncionarioDoSetor = { id: string; atendimentosNoMes: number; livre: boolean };

export type AutorMensagem = "contato" | "ura" | "funcionario";
export type NovaMensagem = { autor: AutorMensagem; texto: string };

export type NovoAtendimento = {
  telefone: string;
  clienteId: string | null;
  setor: string;
  funcionarioId: string | null;
  mensagens: NovaMensagem[];
};

export interface AtendimentoRepositoryPort {
  funcionariosDoSetor(setor: string): Promise<Result<FuncionarioDoSetor[], AppError>>;
  abrir(atendimento: NovoAtendimento): Promise<Result<{ id: string }, AppError>>;
}
