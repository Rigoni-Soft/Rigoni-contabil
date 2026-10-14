import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Converte a gravação do navegador para o formato de mensagem de voz do provedor (ogg/opus, mono).
// Só é chamada quando o formato gravado não é aceito como está (webm).
export interface ConversorDeAudioPort {
  paraOggOpus(conteudo: Uint8Array, tipoMimeOrigem: string): Promise<Result<Uint8Array, AppError>>;
}
