import type {
  ClienteParaConfirmar,
  ResultadoCadastroContatoUra,
} from "@/modules/atendimento/application/ports/out/contato-ura.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

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
