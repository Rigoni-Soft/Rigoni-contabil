import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type ClienteParaConfirmar = { id: string; empresa: string; cnpj: string };

// `existente`: o número já é Contato deste Cliente. `email_em_uso`: o e-mail é de outro Contato do
// Cliente. `em_outro_cliente`: o número é Contato de outro Cliente (não cria: ficaria ambíguo).
export type ResultadoCadastroContatoUra =
  | { status: "criado"; contatoId: string; nome: string }
  | { status: "existente"; contatoId: string; nome: string }
  | { status: "email_em_uso"; contatoId: string; nome: string }
  | { status: "em_outro_cliente" };

// Passo 1: a Recepção digita o CNPJ (a URA sugere) e confere qual Cliente é antes de cadastrar.
export interface BuscarClienteParaContatoUraPort {
  execute(input: {
    atendimentoId: string;
    cnpj: string;
  }): Promise<Result<ClienteParaConfirmar, AppError>>;
}

// Passo 2: o número do Atendimento vira Contato (setor URA, Recepção dona) do Cliente confirmado.
export interface CadastrarContatoUraPort {
  execute(input: {
    atendimentoId: string;
    clienteId: string;
    nome: string;
    email: string | null;
  }): Promise<Result<ResultadoCadastroContatoUra, AppError>>;
}
