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

export interface ContatoUraPort {
  // `cnpj` já normalizado (ver `normalizarCnpj`); null = nenhum Cliente com esse CNPJ.
  clientePorCnpj(cnpj: string): Promise<Result<ClienteParaConfirmar | null, AppError>>;
  // Roda como o usuário logado: o banco confere de novo que ele é da Recepção e dono do Atendimento.
  cadastrar(input: {
    atendimentoId: string;
    clienteId: string;
    nome: string;
    email: string | null;
  }): Promise<Result<ResultadoCadastroContatoUra, AppError>>;
}
