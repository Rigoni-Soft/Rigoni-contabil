import { gerarSenhaProvisoria } from "./supabase-auth-admin.gateway";

describe("gerarSenhaProvisoria", () => {
  it("gera 12 caracteres", () => {
    expect(gerarSenhaProvisoria()).toHaveLength(12);
  });

  it("nunca usa caracteres ambíguos (0/O, 1/I)", () => {
    const senha = gerarSenhaProvisoria();
    expect(senha).not.toMatch(/[01OI]/);
  });

  it("gera senhas diferentes a cada chamada", () => {
    expect(gerarSenhaProvisoria()).not.toBe(gerarSenhaProvisoria());
  });
});
