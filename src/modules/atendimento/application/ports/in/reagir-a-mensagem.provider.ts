import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Reação (emoji) do Funcionário a uma Mensagem do cliente, entregue a ele como reação do WhatsApp.
// Repetir o emoji que já está na Mensagem remove a reação.
export interface ReagirAMensagemPort {
  execute(input: {
    atendimentoId: string;
    mensagemId: string;
    emoji: string;
  }): Promise<Result<void, AppError>>;
}
