import { Parcelamento } from "./parcelamento.vo";

const base = {
  id: "p-1",
  codigo: "PARC-1",
  parcelasRestantes: 3,
  interno: false,
  arquivoCaminho: "c/p.pdf",
};

describe("Parcelamento", () => {
  it("aceita código e parcelas restantes a partir de 1, sem espaços nas pontas", () => {
    const r = Parcelamento.criar({ ...base, codigo: "  PARC-1 ", parcelasRestantes: 1 });
    expect(r.ok && r.value.paraGravar()).toEqual({ ...base, parcelasRestantes: 1 });
  });

  it.each([0, -1, 1.5, Number.NaN])("recusa %p parcelas restantes (mínimo 1, inteiro)", (n) => {
    expect(Parcelamento.criar({ ...base, parcelasRestantes: n }).ok).toBe(false);
  });

  it.each(["", "   ", "x".repeat(61)])("recusa o código %p", (codigo) => {
    expect(Parcelamento.criar({ ...base, codigo }).ok).toBe(false);
  });

  it("recusa sem anexo", () => {
    expect(Parcelamento.criar({ ...base, arquivoCaminho: " " }).ok).toBe(false);
  });
});
