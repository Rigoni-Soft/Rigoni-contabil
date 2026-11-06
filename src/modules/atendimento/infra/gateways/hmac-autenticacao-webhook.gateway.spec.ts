import { createHmac } from "node:crypto";

import { HmacAutenticacaoWebhookGateway } from "./hmac-autenticacao-webhook.gateway";

const gateway = new HmacAutenticacaoWebhookGateway("segredo", "token");
const assinar = (corpo: string, segredo = "segredo") =>
  `sha256=${createHmac("sha256", segredo).update(corpo).digest("hex")}`;

describe("HmacAutenticacaoWebhookGateway", () => {
  it("aceita a assinatura HMAC-SHA256 do corpo cru", () => {
    expect(gateway.assinaturaValida('{"a":1}', assinar('{"a":1}'))).toBe(true);
  });

  it.each([
    ["ausente", null],
    ["sem prefixo sha256=", "abc"],
    ["de outro segredo", assinar('{"a":1}', "outro")],
    ["de outro corpo", assinar('{"a":2}')],
  ])("rejeita assinatura %s", (_, assinatura) => {
    expect(gateway.assinaturaValida('{"a":1}', assinatura)).toBe(false);
  });

  it("valida o token do handshake", () => {
    expect(gateway.tokenValido("token")).toBe(true);
    expect(gateway.tokenValido("errado")).toBe(false);
    expect(gateway.tokenValido(null)).toBe(false);
  });
});
