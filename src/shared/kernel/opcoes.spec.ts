import { opcaoUnica } from "@/shared/kernel/opcoes";

describe("opcaoUnica", () => {
  it("devolve o item quando a lista tem exatamente 1 opção", () => {
    expect(opcaoUnica(["funcionario"])).toBe("funcionario");
  });

  it("devolve undefined quando a lista tem mais de 1 opção", () => {
    expect(opcaoUnica(["lider_setor", "funcionario"])).toBeUndefined();
  });

  it("devolve undefined quando a lista está vazia", () => {
    expect(opcaoUnica([])).toBeUndefined();
  });
});
