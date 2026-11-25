import type { ForbiddenError } from "@/shared/errors/forbidden.error";
import type { Result } from "@/shared/kernel/result";

export interface AutenticarWebhookPort {
  verificarAssinatura(corpoCru: string, assinatura: string | null): Result<void, ForbiddenError>;
  verificarToken(token: string | null): Result<void, ForbiddenError>;
}
