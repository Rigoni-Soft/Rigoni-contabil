import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type MensagemRecebida = { telefone: string; texto: string; id?: string };

export interface ReceberMensagemPort {
  execute(mensagem: MensagemRecebida): Promise<Result<void, AppError>>;
}
