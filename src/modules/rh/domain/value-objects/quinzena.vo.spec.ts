import { diasDaQuinzena } from "@/modules/rh/domain/value-objects/quinzena.vo";

describe("diasDaQuinzena", () => {
  it("primeira quinzena: dias 1 a 15", () => {
    const dias = diasDaQuinzena("2026-11", 1);
    expect(dias).toHaveLength(15);
    expect(dias[0]).toBe("2026-11-01");
    expect(dias[14]).toBe("2026-11-15");
  });

  it("segunda quinzena vai até o último dia do mês (30, 31 e fevereiro bissexto)", () => {
    expect(diasDaQuinzena("2026-11", 2).at(-1)).toBe("2026-11-30");
    expect(diasDaQuinzena("2026-12", 2)).toHaveLength(16);
    expect(diasDaQuinzena("2028-02", 2).at(-1)).toBe("2028-02-29");
  });
});
