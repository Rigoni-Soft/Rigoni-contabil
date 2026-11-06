import { descricaoDoCampo } from "./descricao-do-campo";

describe("descricaoDoCampo", () => {
  it("junta só os ids presentes, na ordem recebida", () => {
    expect(descricaoDoCampo("externo", false, "n-ajuda", undefined, "n-erro")).toBe(
      "externo n-ajuda n-erro",
    );
  });

  it("sem nenhum id, não gera o atributo", () => {
    expect(descricaoDoCampo(false, undefined, null)).toBeUndefined();
  });
});
