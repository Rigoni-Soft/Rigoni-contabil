import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type MensagemEnviada = { telefone: string; texto: string };

// Ou um endereço que o provedor busca (`url`), ou o próprio PDF (`pdfBase64`, que o adapter real
// sobe como mídia antes de enviar).
export type DocumentoEnviado = { telefone: string; nomeArquivo: string } & (
  { url: string } | { pdfBase64: string }
);

export interface EnvioMensagemPort {
  enviar(mensagem: MensagemEnviada): Promise<Result<void, AppError>>;
  enviarDocumento(documento: DocumentoEnviado): Promise<Result<void, AppError>>;
}
