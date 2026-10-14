import { formaEnvioUsaEmail, formaEnvioUsaWhatsapp } from "./forma-envio";

describe("canais da forma de envio", () => {
  it.each([
    ["whatsapp", true, false],
    ["email", false, true],
    ["whatsapp_e_email", true, true],
  ] as const)("%s: WhatsApp=%s, e-mail=%s", (forma, whatsapp, email) => {
    expect(formaEnvioUsaWhatsapp(forma)).toBe(whatsapp);
    expect(formaEnvioUsaEmail(forma)).toBe(email);
  });
});
