import type { DocumentoDisponivel } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Dispara o mesmo serviço do menu da URA (contrato social / alteração), usando o Cliente já
// vinculado ao Atendimento.
export interface EnviarDocumentoAoClientePort {
  execute(input: {
    atendimentoId: string;
    documento: DocumentoDisponivel;
  }): Promise<Result<void, AppError>>;
}
