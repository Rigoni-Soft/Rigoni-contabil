import { conferirGuiaLida, validarGuiaParcelaPgfn } from "./guia-parcela-pgfn.vo";

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

describe("conferirGuiaLida", () => {
  const parcelamento = { cnpj: "10690529000138", codigo: "150141670" };
  const lida = {
    cnpj: "10.690.529/0001-38",
    contaNegociacao: "150141670",
    competencia: "202610",
  };

  it("CNPJ, conta e competência conferindo: sem motivo (nasce confirmada)", () => {
    const r = conferirGuiaLida(lida, parcelamento, {});
    expect(r.ok && r.value).toEqual({
      competencia: "202610",
      contaNegociacao: "150141670",
      motivo: null,
    });
  });

  it("CNPJ de outra empresa recusa", () => {
    const r = conferirGuiaLida({ ...lida, cnpj: "11.444.777/0001-61" }, parcelamento, {});
    expect(r.ok).toBe(false);
  });

  it("conta diferente da do Parcelamento deixa a confirmar, com o motivo", () => {
    const r = conferirGuiaLida({ ...lida, contaNegociacao: "999" }, parcelamento, {});
    expect(r.ok && r.value.motivo).toMatch(/conta do PDF \(999\)/);
    expect(r.ok && r.value.contaNegociacao).toBe("999");
  });

  it.each([
    ["CNPJ", { cnpj: null }],
    ["conta", { contaNegociacao: null }],
    ["competência", { competencia: null }],
  ])("PDF sem %s deixa a confirmar", (_nome, falta) => {
    const r = conferirGuiaLida({ ...lida, ...falta }, parcelamento, { competencia: "202610" });
    expect(r.ok && r.value.motivo).not.toBeNull();
  });

  it("PDF não lido: vale o digitado, a confirmar; a conta cai na do Parcelamento", () => {
    const r = conferirGuiaLida(null, parcelamento, { competencia: "202609" });
    expect(r.ok && r.value).toMatchObject({
      competencia: "202609",
      contaNegociacao: "150141670",
    });
    expect(r.ok && r.value.motivo).not.toBeNull();
  });

  it("sem competência lida nem digitada, pede a competência", () => {
    const r = conferirGuiaLida(null, parcelamento, {});
    expect(!r.ok && r.error.message).toMatch(/competência/i);
  });

  it("digitado diferente do lido deixa a confirmar", () => {
    const r = conferirGuiaLida(lida, parcelamento, { competencia: "202611" });
    expect(r.ok && r.value.competencia).toBe("202611");
    expect(r.ok && r.value.motivo).not.toBeNull();
  });
});
