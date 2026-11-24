import type {
  EmailParaEnvio,
  EnvioEmailPort,
} from "@/modules/atendimento/application/ports/out/envio-email.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, type Result } from "@/shared/kernel/result";

export class EnvioEmailIndisponivelGateway implements EnvioEmailPort {
  async enviar(email: EmailParaEnvio): Promise<Result<void, AppError>> {
    void email;
    return err(new ValidationError("Envio de e-mail ainda não configurado (#86)."));
  }
}
