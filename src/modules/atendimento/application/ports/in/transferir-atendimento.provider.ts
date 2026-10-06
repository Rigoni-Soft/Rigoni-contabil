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
// `destinatarioNome` null = nenhum Funcionário livre no Setor (a Fila é do #46).
export type TransferenciaConcluida = {
  destinatarioNome: string | null;
  contato: DadosDoContato;
  origemSetor: SetorSlug;
  origemNome: string | null;
  resumo: string;
};

export interface TransferirAtendimentoPort {
  execute(input: TransferirAtendimentoInput): Promise<Result<TransferenciaConcluida, AppError>>;
}
