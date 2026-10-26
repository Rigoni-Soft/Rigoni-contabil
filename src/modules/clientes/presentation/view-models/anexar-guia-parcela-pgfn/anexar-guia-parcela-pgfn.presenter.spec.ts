import { competenciaDoMes, idDaGuia } from "./anexar-guia-parcela-pgfn.presenter";

describe("competenciaDoMes", () => {
  it.each([
    ["2026-10", "202610"],
    ["10/2026", "202610"],
    [" 3/2026 ", "202603"],
    ["", ""],
  ])("%p vira %p", (entrada, esperado) => {
    expect(competenciaDoMes(entrada)).toBe(esperado);
  });

  it("forma desconhecida passa como está (o schema recusa)", () => {
    expect(competenciaDoMes("outubro")).toBe("outubro");
  });
});

it("idDaGuia junta o prefixo da região e a competência", () => {
  expect(idDaGuia("guias-p1", "202610")).toBe("guias-p1-guia-202610");
});
