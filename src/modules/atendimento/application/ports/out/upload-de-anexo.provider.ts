import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export interface UploadDeAnexoPort {
  enviar(input: {
    atendimentoId: string;
    nome: string;
    tipoMime: string;
    conteudo: Blob;
  }): Promise<Result<string, AppError>>;
}
