import { createHmac, timingSafeEqual } from "node:crypto";

import type { AutenticacaoWebhookPort } from "@/modules/atendimento/application/ports/out/autenticacao-webhook.provider";

function iguais(primeiro: string, segundo: string): boolean {
  const bytesPrimeiro = Buffer.from(primeiro);
  const bytesSegundo = Buffer.from(segundo);
  return (
    bytesPrimeiro.length === bytesSegundo.length && timingSafeEqual(bytesPrimeiro, bytesSegundo)
  );
}

// Assinatura no formato da Meta: cabeçalho `X-Hub-Signature-256: sha256=<hex>`,
// HMAC-SHA256 do corpo cru com o segredo do app.
export class HmacAutenticacaoWebhookGateway implements AutenticacaoWebhookPort {
  constructor(
    private readonly segredo: string,
    private readonly tokenVerificacao: string,
  ) {}

  assinaturaValida(corpoCru: string, assinatura: string | null): boolean {
    if (!assinatura?.startsWith("sha256=")) return false;
    const esperada = createHmac("sha256", this.segredo).update(corpoCru).digest("hex");
    return iguais(assinatura.slice("sha256=".length), esperada);
  }

  tokenValido(token: string | null): boolean {
    return token !== null && iguais(token, this.tokenVerificacao);
  }
}
