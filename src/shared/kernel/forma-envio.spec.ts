import {
  canalPerdidoDoDestino,
  formaEnvioUsaEmail,
  formaEnvioUsaWhatsapp,
  temOsDoisCanais,
} from "./forma-envio";

describe("temOsDoisCanais", () => {
  it.each([
    ["11999990000", "a@b.com", true],
    ["11999990000", "", false],
    ["", "a@b.com", false],
    ["", "", false],
    ["(11) 99999-0000", " a@b.com ", true],
  ])("telefone '%s' e e-mail '%s': %s", (telefone, email, esperado) => {
    expect(temOsDoisCanais({ telefone, email })).toBe(esperado);
  });
});

describe("canalPerdidoDoDestino", () => {
  it.each([
    ["whatsapp", "", "a@b.com", "whatsapp"],
    ["email", "11999990000", "", "email"],
    ["whatsapp_e_email", "11999990000", "", "email"],
    ["whatsapp_e_email", "", "a@b.com", "whatsapp"],
    ["whatsapp", "11999990000", "", null],
    ["whatsapp_e_email", "11999990000", "a@b.com", null],
  ] as const)("%s com telefone '%s' e e-mail '%s' perdeu %s", (canal, telefone, email, perdido) => {
    expect(canalPerdidoDoDestino(canal, { telefone, email })).toBe(perdido);
  });
});

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
