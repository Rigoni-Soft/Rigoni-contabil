import { mensagemDaFalha } from "./mensagem-da-falha";

describe("mensagemDaFalha", () => {
  it("TypeError é falta de conexão; o resto é erro do servidor", () => {
    expect(mensagemDaFalha(new TypeError("fetch"))).toMatch(/Sem conexão/);
    expect(mensagemDaFalha(new Error("x"))).toMatch(/Erro inesperado/);
  });
});
