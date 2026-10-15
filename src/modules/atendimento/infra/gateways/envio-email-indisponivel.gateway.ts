import type {
  EmailParaEnvio,
  EnvioEmailPort,
} from "@/modules/atendimento/application/ports/out/envio-email.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, type Result } from "@/shared/kernel/result";

// Produção sem adapter real de e-mail (#86): o canal falha de forma explícita, em vez de o
// adapter falso responder ok e o DAS ser marcado como enviado sem ninguém ter recebido. Não é
// falha transitória, então o job não repete: vira alerta do setor na hora.
export class EnvioEmailIndisponivelGateway implements EnvioEmailPort {
  async enviar(email: EmailParaEnvio): Promise<Result<void, AppError>> {
    void email;
    return err(new ValidationError("Envio de e-mail ainda não configurado (#86)."));
  }
}
