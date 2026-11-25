import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

export type TransferirAtendimentoInput = {
  atendimentoId: string;
  setorDestino: SetorSlug;
  resumo: string;
};

export type DadosDoContato = {
  contatoNome: string | null;
  empresa: string | null;
  cnpj: string | null;
};

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
