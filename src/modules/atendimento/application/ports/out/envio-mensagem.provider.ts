import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type MensagemEnviada = { telefone: string; texto: string };

export type DocumentoEnviado = { telefone: string; url: string; nomeArquivo: string };

export interface EnvioMensagemPort {
  enviar(mensagem: MensagemEnviada): Promise<Result<void, AppError>>;
  enviarDocumento(documento: DocumentoEnviado): Promise<Result<void, AppError>>;
}
