import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

export type AutorMensagem = "contato" | "ura" | "funcionario";
export type NovaMensagem = { autor: AutorMensagem; texto: string };

// `telefone` como chegou (resposta); `chave` só dígitos nacionais (identifica o Atendimento).
export type AberturaAtendimento = {
  telefone: string;
  chave: string;
  clienteId: string | null;
  setor: SetorSlug;
  mensagens: NovaMensagem[];
};

// `funcionarioId` null = nenhum Funcionário livre no Setor (a Fila é do #45).
export type AtendimentoAberto = { id: string; funcionarioId: string | null };

export interface AbrirAtendimentoPort {
  execute(abertura: AberturaAtendimento): Promise<Result<AtendimentoAberto, AppError>>;
  // Mensagem de um número que já tem Atendimento em andamento entra nele, sem recomeçar a URA.
  // true = havia Atendimento em andamento e a Mensagem foi anexada.
  anexarSeEmAndamento(chave: string, mensagem: NovaMensagem): Promise<Result<boolean, AppError>>;
}
