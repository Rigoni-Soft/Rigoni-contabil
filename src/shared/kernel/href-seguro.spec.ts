import { hrefSeguro } from "./href-seguro";

describe("hrefSeguro", () => {
  it.each(["/", "/simples-nacional", "/clientes/resumo/x?a=1"])(
    "aceita caminho do site: %s",
    (v) => {
      expect(hrefSeguro(v)).toBe(v);
    },
  );

  it.each([undefined, "", "//evil.com", "https://evil.com", "evil.com", "/a?u=http://x"])(
    "cai no padrão: %s",
    (v) => {
      expect(hrefSeguro(v)).toBe("/");
    },
  );

  it("aceita padrão customizado", () => {
    expect(hrefSeguro("//x", "/home")).toBe("/home");
  });
});
