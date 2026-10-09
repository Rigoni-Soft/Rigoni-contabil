import { formatarEspera } from "./espera.service";

describe("formatarEspera", () => {
  it("abaixo de 1h mostra só mm:ss", () => {
    expect(formatarEspera(0)).toBe("00:00");
    expect(formatarEspera(65_000)).toBe("01:05");
    expect(formatarEspera(59 * 60_000 + 59_000)).toBe("59:59");
  });

  it("a partir de 1h mostra h:mm:ss", () => {
    expect(formatarEspera(3_600_000)).toBe("1:00:00");
    expect(formatarEspera(3_600_000 + 5 * 60_000 + 7_000)).toBe("1:05:07");
    expect(formatarEspera(26 * 3_600_000)).toBe("26:00:00");
  });

  it("descarta fração de segundo e nunca fica negativo (relógios defasados)", () => {
    expect(formatarEspera(1_999)).toBe("00:01");
    expect(formatarEspera(-5_000)).toBe("00:00");
  });
});
