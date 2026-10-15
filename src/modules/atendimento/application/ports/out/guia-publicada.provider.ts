import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Guarda o PDF da guia e devolve o endereço temporário que o provedor de mensagem/e-mail busca.
export interface GuiaPublicadaPort {
  publicar(
    clienteId: string,
    guia: { nomeArquivo: string; pdfBase64: string },
  ): Promise<Result<string, AppError>>;
}
