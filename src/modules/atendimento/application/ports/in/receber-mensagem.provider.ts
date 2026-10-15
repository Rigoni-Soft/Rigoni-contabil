import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Contrato neutro (docs/contratos/mensageria.md): sem jargão de canal/provedor.
// `id`: identificador da mensagem no provedor, quando ele informa.
export type MensagemRecebida = { telefone: string; texto: string; id?: string };

export interface ReceberMensagemPort {
  execute(mensagem: MensagemRecebida): Promise<Result<void, AppError>>;
}
