import { criarAdminLocal } from "./admin-supabase-local";

describe("criarAdminLocal", () => {
  it("destino local: cria o client", () => {
    const criar = jest.fn(() => ({}) as never);
    criarAdminLocal("chave", "http://127.0.0.1:54321", criar);
    expect(criar).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["URL remota com a chave presente", "https://projeto.supabase.co"],
    ["URL remota com credencial na URL", "https://usuario:senha@projeto.supabase.co"],
    ["URL inválida", "isto-nao-e-url"],
    ["vazia", ""],
    ["host que só começa com localhost", "http://localhost.evil.com"],
    ["loopback só no caminho", "https://remoto.com/127.0.0.1"],
  ])("%s: falha antes de criar o client", (_nome, url) => {
    const criar = jest.fn(() => ({}) as never);
    expect(() => criarAdminLocal("chave-real", url, criar)).toThrow();
    expect(criar).not.toHaveBeenCalled();
  });
});
