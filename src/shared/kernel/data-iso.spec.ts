import { formatarCompetencia, formatarDataIso } from "./data-iso";

describe("data-iso", () => {
  it("formata a data ISO como DD/MM/AAAA", () => {
    expect(formatarDataIso("2026-10-20")).toBe("20/10/2026");
  });

  it("formata a competência AAAA-MM como MM/AAAA", () => {
    expect(formatarCompetencia("2026-09")).toBe("09/2026");
  });
});
