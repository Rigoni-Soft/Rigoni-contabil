import type {
  EmailParaEnvio,
  EnvioEmailPort,
} from "@/modules/atendimento/application/ports/out/envio-email.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ok, type Result } from "@/shared/kernel/result";

// Adapter falso (padrão em dev/e2e): só registra no log o que "enviou".
export class EnvioEmailFalsoGateway implements EnvioEmailPort {
  async enviar(email: EmailParaEnvio): Promise<Result<void, AppError>> {
    console.info(`[e-mail falso] para ${email.para}: ${email.assunto}`);
    return ok(undefined);
  }
}
