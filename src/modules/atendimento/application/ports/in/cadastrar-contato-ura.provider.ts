import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type ClienteParaConfirmar = { id: string; empresa: string; cnpj: string };

export type ResultadoCadastroContatoUra =
  | { status: "criado"; contatoId: string; nome: string }
  | { status: "existente"; contatoId: string; nome: string }
  | { status: "email_em_uso"; contatoId: string; nome: string }
  | { status: "em_outro_cliente" };

export type BuscaClienteContatoUraInput = { atendimentoId: string; cnpj: string };

export interface BuscarClienteParaContatoUraPort {
  execute(input: BuscaClienteContatoUraInput): Promise<Result<ClienteParaConfirmar, AppError>>;
}

export type CadastroContatoUraInput = {
  atendimentoId: string;
  clienteId: string;
  nome: string;
  email: string | null;
};

export interface CadastrarContatoUraPort {
  execute(input: CadastroContatoUraInput): Promise<Result<ResultadoCadastroContatoUra, AppError>>;
}
