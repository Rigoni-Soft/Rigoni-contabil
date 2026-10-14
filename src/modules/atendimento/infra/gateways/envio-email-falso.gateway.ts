import type {
  EmailEnviado,
  EnvioEmailPort,
} from "@/modules/atendimento/application/ports/out/envio-email.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ok, type Result } from "@/shared/kernel/result";

// Adapter falso (padrão em dev/e2e): guarda em memória o que "enviou". O real vem depois do #68.
// ponytail: lista em memória sem limite, some a cada restart.
export class EnvioEmailFalsoGateway implements EnvioEmailPort {
  readonly enviados: EmailEnviado[] = [];

  async enviar(email: EmailEnviado): Promise<Result<void, AppError>> {
    this.enviados.push(email);
    console.info(`[e-mail falso] para ${email.para}: ${email.assunto}`);
    return ok(undefined);
  }
}
