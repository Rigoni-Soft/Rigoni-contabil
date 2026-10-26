import { validarGuiaParcelaPgfn } from "./guia-parcela-pgfn.vo";

const base = {
  competencia: "202610",
  contaNegociacao: "123456",
  arquivoCaminho: "c/p/202610-g.pdf",
};

describe("validarGuiaParcelaPgfn", () => {
  it("aceita a competência AAAAMM e apara a conta", () => {
    const r = validarGuiaParcelaPgfn({ ...base, contaNegociacao: " 123456 " });
    expect(r.ok && r.value).toEqual(base);
  });

  it.each(["", "2026-10", "202613", "202600", "20261", "abcdef"])(
    "recusa a competência %p",
    (c) => {
      expect(validarGuiaParcelaPgfn({ ...base, competencia: c }).ok).toBe(false);
    },
  );

  it.each(["", "   ", "9".repeat(41)])("recusa a conta %p", (conta) => {
    expect(validarGuiaParcelaPgfn({ ...base, contaNegociacao: conta }).ok).toBe(false);
  });
});
