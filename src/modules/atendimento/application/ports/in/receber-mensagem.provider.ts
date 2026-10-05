import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Contrato neutro (docs/contratos/mensageria.md): sem jargão de canal/provedor.
export type MensagemRecebida = { telefone: string; texto: string };

export interface ReceberMensagemPort {
  execute(mensagem: MensagemRecebida): Promise<Result<void, AppError>>;
}
