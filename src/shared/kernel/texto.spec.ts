import { contarCaracteres, emojiValido } from "./texto";

describe("contarCaracteres", () => {
  it("conta emoji como 1 caractere, não como 2 unidades UTF-16", () => {
    expect("😀".length).toBe(2);
    expect(contarCaracteres("😀")).toBe(1);
    expect(contarCaracteres("Oi 👍")).toBe(4);
    expect(contarCaracteres("")).toBe(0);
  });
});

describe("emojiValido", () => {
  it("aceita emoji simples, composto, com tom de pele, bandeira e keycap", () => {
    for (const e of ["👍", "❤️", "👨‍👩‍👧", "👍🏽", "🇧🇷", "1️⃣"]) expect(emojiValido(e)).toBe(true);
  });

  it("recusa vazio, texto comum, número solto e acima do limite", () => {
    for (const e of ["", "oi", "123", "a👍", "👍".repeat(9)]) expect(emojiValido(e)).toBe(false);
  });
});
