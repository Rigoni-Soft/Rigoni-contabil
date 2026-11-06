import { DasStatus } from "./das-status.vo";

describe("DasStatus", () => {
  it("cria um status válido", () => {
    const resultado = DasStatus.criar("pronto");

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.value.valor).toBe("pronto");
  });

  it("rejeita um status desconhecido", () => {
    const resultado = DasStatus.criar("inexistente");

    expect(resultado.ok).toBe(false);
  });
});
