import { ParcelamentoStatus } from "./parcelamento-status.vo";

describe("ParcelamentoStatus", () => {
  it("cria um status válido", () => {
    const resultado = ParcelamentoStatus.criar("enviado");

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.value.valor).toBe("enviado");
  });

  it("rejeita um status desconhecido", () => {
    const resultado = ParcelamentoStatus.criar("inexistente");

    expect(resultado.ok).toBe(false);
  });
});
