import { formaEnvioUsaEmail, formaEnvioUsaWhatsapp, temDestinatario } from "./forma-envio";

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

describe("temDestinatario", () => {
  const contato = { nome: "Ângela", telefone: "5511912345678" };

  it.each([
    ["whatsapp", contato, null, true],
    ["whatsapp", null, "a@b.com", false],
    ["email", null, "a@b.com", true],
    ["email", contato, null, false],
    ["whatsapp_e_email", null, "a@b.com", true],
    ["whatsapp_e_email", contato, null, true],
    ["whatsapp_e_email", null, null, false],
  ] as const)("%s com contato=%j e e-mail=%s: %s", (formaEnvio, c, email, esperado) => {
    expect(temDestinatario({ formaEnvio, contato: c, email })).toBe(esperado);
  });
});
