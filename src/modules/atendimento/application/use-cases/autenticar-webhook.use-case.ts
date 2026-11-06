import type { AutenticarWebhookPort } from "@/modules/atendimento/application/ports/in/autenticar-webhook.provider";
import type { AutenticacaoWebhookPort } from "@/modules/atendimento/application/ports/out/autenticacao-webhook.provider";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok, type Result } from "@/shared/kernel/result";

export class AutenticarWebhook implements AutenticarWebhookPort {
  constructor(private readonly autenticacao: AutenticacaoWebhookPort) {}

  verificarAssinatura(corpoCru: string, assinatura: string | null): Result<void, ForbiddenError> {
    if (this.autenticacao.assinaturaValida(corpoCru, assinatura)) return ok(undefined);
    return err(new ForbiddenError("Assinatura inválida."));
  }

  verificarToken(token: string | null): Result<void, ForbiddenError> {
    if (this.autenticacao.tokenValido(token)) return ok(undefined);
    return err(new ForbiddenError("Token de verificação inválido."));
  }
}
