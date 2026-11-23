import type {
  ClienteParaConfirmar,
  ResultadoCadastroContatoUra,
} from "@/modules/atendimento/application/ports/in/cadastrar-contato-ura.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

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
