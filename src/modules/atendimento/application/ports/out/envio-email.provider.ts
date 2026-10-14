import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type EmailEnviado = {
  para: string;
  assunto: string;
  texto: string;
  anexo?: { url: string; nomeArquivo: string };
};

export interface EnvioEmailPort {
  enviar(email: EmailEnviado): Promise<Result<void, AppError>>;
}
