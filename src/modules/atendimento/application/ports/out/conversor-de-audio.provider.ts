import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export interface ConversorDeAudioPort {
  paraOggOpus(conteudo: Uint8Array): Promise<Result<Uint8Array, AppError>>;
}
