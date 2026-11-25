import type {
  CadastroContatoUraInput,
  ClienteParaConfirmar,
  ResultadoCadastroContatoUra,
} from "@/modules/atendimento/application/ports/in/cadastrar-contato-ura.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export interface ContatoUraPort {
  clientePorCnpj(cnpj: string): Promise<Result<ClienteParaConfirmar | null, AppError>>;
  cadastrar(input: CadastroContatoUraInput): Promise<Result<ResultadoCadastroContatoUra, AppError>>;
}
