import { dataNaoFutura } from "./data-alteracao";
import { hojeIso } from "./mes-atual";

const AMANHA = () => hojeIso(new Date(Date.now() + 24 * 60 * 60 * 1000));
const ONTEM = () => hojeIso(new Date(Date.now() - 24 * 60 * 60 * 1000));

describe("dataNaoFutura", () => {
  it.each([() => hojeIso(), ONTEM])("aceita hoje e ontem", (data) => {
    expect(dataNaoFutura.safeParse(data()).success).toBe(true);
  });

  it.each([
    ["amanhã", AMANHA],
    ["01/01/2100 (formato alternativo)", () => "01/01/2100"],
    ["2100-01-01", () => "2100-01-01"],
    ["data impossível", () => "2026-02-30"],
    ["texto", () => "abc"],
  ])("recusa %s", (_, data) => {
    expect(dataNaoFutura.safeParse(data()).success).toBe(false);
  });

  it("vazio pede a data", () => {
    const r = dataNaoFutura.safeParse("");
    expect(!r.success && r.error.issues[0].message).toBe("Data obrigatória");
  });
});
