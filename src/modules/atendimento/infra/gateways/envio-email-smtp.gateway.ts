import { createTransport } from "nodemailer";

import type {
  EmailParaEnvio,
  EnvioEmailPort,
} from "@/modules/atendimento/application/ports/out/envio-email.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

const AVISO_NAO_RESPONDER =
  "\n\n--\nEsta é uma mensagem automática. Por favor, não responda este e-mail.";

// Só o que o gateway usa do transporte (o do nodemailer atende; os testes passam um falso).
export type TransporteEmail = { sendMail(mensagem: object): Promise<unknown> };

export type ConfigSmtp = { usuario: string; senha: string; remetente: string };

// Adapter real da porta EnvioEmailPort, por SMTP do Gmail com senha de app. Endereço
// recusado (EENVELOPE ou 550-553) não melhora ao repetir: ValidationError. O resto (senha de app
// inválida, limite diário, indisponibilidade, rede) é falha do serviço: ServicoExternoError.
// O Gmail não deduplica envios: uma falha após o aceite pode repetir o e-mail na retentativa.
export class EnvioEmailSmtpGateway implements EnvioEmailPort {
  constructor(
    private readonly config: ConfigSmtp,
    private readonly transporte: TransporteEmail = createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: config.usuario, pass: config.senha },
      connectionTimeout: 10_000,
    }),
  ) {}

  async enviar(email: EmailParaEnvio): Promise<Result<void, AppError>> {
    try {
      await this.transporte.sendMail({
        from: this.config.remetente,
        to: email.para,
        subject: email.assunto,
        text: email.texto + AVISO_NAO_RESPONDER,
        ...(email.anexo && {
          attachments: [{ filename: email.anexo.nomeArquivo, path: email.anexo.url }],
        }),
      });
      return ok(undefined);
    } catch (e) {
      const { code, responseCode } = e as { code?: string; responseCode?: number };
      if (
        code === "EENVELOPE" ||
        (responseCode !== undefined && responseCode >= 550 && responseCode <= 553)
      ) {
        return err(new ValidationError("E-mail recusado pelo provedor (destinatário inválido)."));
      }
      return err(new ServicoExternoError("Serviço de e-mail indisponível."));
    }
  }
}
