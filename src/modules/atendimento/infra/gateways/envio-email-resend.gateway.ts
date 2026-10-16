import { createHash } from "node:crypto";

import type {
  EmailParaEnvio,
  EnvioEmailPort,
} from "@/modules/atendimento/application/ports/out/envio-email.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { hojeIso } from "@/shared/kernel/mes-atual";
import { err, ok, type Result } from "@/shared/kernel/result";

const URL_ENVIO = "https://api.resend.com/emails";
const TIMEOUT_MS = 10_000;

// Adapter real da porta EnvioEmailPort (#86), pela API HTTP do Resend (o MCP é só apoio de
// desenvolvimento: o job do Vercel Cron não o chama). 400/422 (destinatário ou campo inválido)
// não melhora ao repetir: ValidationError. O resto (401/403 de credencial, 429 de limite, 5xx,
// rede) é falha do serviço: ServicoExternoError.
export class EnvioEmailResendGateway implements EnvioEmailPort {
  constructor(
    private readonly apiKey: string,
    private readonly remetente: string,
    private readonly http: typeof fetch = fetch,
    private readonly agora: () => Date = () => new Date(),
  ) {}

  async enviar(email: EmailParaEnvio): Promise<Result<void, AppError>> {
    const corpo = {
      from: this.remetente,
      to: [email.para],
      subject: email.assunto,
      text: email.texto,
      ...(email.anexo && {
        attachments: [{ path: email.anexo.url, filename: email.anexo.nomeArquivo }],
      }),
    };
    try {
      const r = await this.http(URL_ENVIO, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          // A retentativa do job no mesmo dia não duplica o e-mail.
          "Idempotency-Key": this.chaveDeIdempotencia(email),
        },
        body: JSON.stringify(corpo),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (r.ok) return ok(undefined);
      if (r.status === 400 || r.status === 422) {
        return err(
          new ValidationError("E-mail recusado pelo provedor (destinatário ou dados inválidos)."),
        );
      }
      return err(new ServicoExternoError(`Serviço de e-mail respondeu ${r.status}.`));
    } catch {
      return err(new ServicoExternoError("Serviço de e-mail indisponível."));
    }
  }

  private chaveDeIdempotencia(email: EmailParaEnvio): string {
    const base = [email.para, email.assunto, email.anexo?.nomeArquivo ?? "", hojeIso(this.agora())];
    return createHash("sha256").update(base.join("|")).digest("hex");
  }
}
