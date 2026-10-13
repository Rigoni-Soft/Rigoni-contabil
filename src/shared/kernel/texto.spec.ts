import { contarCaracteres } from "./texto";

describe("contarCaracteres", () => {
  it("conta emoji como 1 caractere, não como 2 unidades UTF-16", () => {
    expect("😀".length).toBe(2);
    expect(contarCaracteres("😀")).toBe(1);
    expect(contarCaracteres("Oi 👍")).toBe(4);
    expect(contarCaracteres("")).toBe(0);
  });
});
