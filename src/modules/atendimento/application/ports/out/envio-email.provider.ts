import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type EmailParaEnvio = {
  para: string;
  assunto: string;
  texto: string;
  anexo?: { url: string; nomeArquivo: string };
};

export interface EnvioEmailPort {
  enviar(email: EmailParaEnvio): Promise<Result<void, AppError>>;
}
