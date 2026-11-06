import type { ForbiddenError } from "@/shared/errors/forbidden.error";
import type { Result } from "@/shared/kernel/result";

// Prova de origem de uma chamada de fora: o handler só pergunta e converte o resultado em HTTP.
export interface AutenticarWebhookPort {
  verificarAssinatura(corpoCru: string, assinatura: string | null): Result<void, ForbiddenError>;
  verificarToken(token: string | null): Result<void, ForbiddenError>;
}
