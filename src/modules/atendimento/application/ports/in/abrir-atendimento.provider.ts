import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

export type AutorMensagem = "contato" | "ura" | "funcionario";
export type NovaMensagem = { autor: AutorMensagem; texto: string; idExterno?: string };

export type AberturaAtendimento = {
  telefone: string;
  chave: string;
  clienteId: string | null;
  setor: SetorSlug;
  mensagens: NovaMensagem[];
  resumo?: string;
  cnpjInformado?: string;
};

export type AtendimentoAberto = { id: string };

export interface AbrirAtendimentoPort {
  execute(abertura: AberturaAtendimento): Promise<Result<AtendimentoAberto, AppError>>;
}
