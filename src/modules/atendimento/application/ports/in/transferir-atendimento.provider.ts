import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

export type TransferirAtendimentoInput = {
  atendimentoId: string;
  setorDestino: SetorSlug;
  resumo: string;
};

// Campos null quando o número ainda não foi identificado (ex.: Atendimento aberto na recepção
// sem Cliente).
export type DadosDoContato = {
  contatoNome: string | null;
  empresa: string | null;
  cnpj: string | null;
};

// O que o Funcionário de destino recebe.
// `destinatarioNome` null = ninguém escolhido (nenhum usuário livre no Setor: fila do Setor).
// `naFila` = o destino escolhido estava ocupado e o Atendimento entrou na fila dele.
export type TransferenciaConcluida = {
  destinatarioNome: string | null;
  naFila: boolean;
  contato: DadosDoContato;
  origemSetor: SetorSlug;
  origemNome: string | null;
  resumo: string;
  // Atendimento da Fila que o Funcionário de origem, agora livre, assumiu; null se não havia.
  proximoDaFila: string | null;
};

export interface TransferirAtendimentoPort {
  execute(input: TransferirAtendimentoInput): Promise<Result<TransferenciaConcluida, AppError>>;
}
