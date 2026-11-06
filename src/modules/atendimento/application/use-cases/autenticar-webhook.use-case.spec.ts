import type { AutenticacaoWebhookPort } from "@/modules/atendimento/application/ports/out/autenticacao-webhook.provider";
import { AutenticarWebhook } from "@/modules/atendimento/application/use-cases/autenticar-webhook.use-case";
import { ForbiddenError } from "@/shared/errors/forbidden.error";

const autenticacao = (valido: boolean): AutenticacaoWebhookPort => ({
  assinaturaValida: () => valido,
  tokenValido: () => valido,
});

describe("AutenticarWebhook", () => {
  it("assinatura válida passa", () => {
    const r = new AutenticarWebhook(autenticacao(true)).verificarAssinatura("{}", "sha256=x");
    expect(r.ok).toBe(true);
  });

  it("assinatura inválida vira ForbiddenError", () => {
    const r = new AutenticarWebhook(autenticacao(false)).verificarAssinatura("{}", null);
    expect(!r.ok && r.error).toBeInstanceOf(ForbiddenError);
  });

  it("token válido passa e inválido vira ForbiddenError", () => {
    expect(new AutenticarWebhook(autenticacao(true)).verificarToken("t").ok).toBe(true);
    const r = new AutenticarWebhook(autenticacao(false)).verificarToken(null);
    expect(!r.ok && r.error).toBeInstanceOf(ForbiddenError);
  });
});
