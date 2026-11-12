import {
  validarJornada,
  validarNome,
  validarPares,
} from "@/modules/rh/domain/services/validar-ponto.service";

describe("validarNome", () => {
  it("apara o nome", () => {
    expect(validarNome("  Ana Souza ")).toEqual({ ok: true, value: "Ana Souza" });
  });

  it.each([["vazio", ""], ["só espaços", "   "], ["acima de 120", "x".repeat(121)]])(
    "recusa nome %s",
    (_caso, nome) => {
      const r = validarNome(nome);
      expect(!r.ok && r.error.code).toBe("VALIDATION_ERROR");
    },
  );

  it("aceita o limite de 120", () => {
    expect(validarNome("x".repeat(120)).ok).toBe(true);
  });
});

describe("validarJornada", () => {
  it("aceita 7 dias de 0 a 1440 minutos", () => {
    expect(validarJornada([0, 480, 480, 480, 480, 480, 1440]).ok).toBe(true);
  });

  it.each([
    ["6 dias", [0, 480, 480, 480, 480, 480]],
    ["8 dias", [0, 480, 480, 480, 480, 480, 0, 0]],
    ["negativo", [0, -1, 480, 480, 480, 480, 0]],
    ["acima de 24 h", [0, 1441, 480, 480, 480, 480, 0]],
    ["fracionado", [0, 480.5, 480, 480, 480, 480, 0]],
    ["NaN", [0, Number.NaN, 480, 480, 480, 480, 0]],
  ])("recusa jornada com %s", (_caso, jornada) => {
    const r = validarJornada(jornada);
    expect(!r.ok && r.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("validarPares", () => {
  const par = { entrada: 480, saida: 720 };

  it("aceita até o máximo de pares", () => {
    expect(validarPares([par, par], 2).ok).toBe(true);
    expect(validarPares([], 4).ok).toBe(true);
  });

  it("recusa mais pares que o máximo", () => {
    expect(validarPares([par, par, par], 2).ok).toBe(false);
  });

  it.each([
    ["entrada fora do dia", { entrada: 1440, saida: 100 }],
    ["saída fora do dia", { entrada: 480, saida: 1440 }],
    ["negativo", { entrada: -1, saida: 100 }],
    ["fracionado", { entrada: 480.5, saida: 720 }],
    ["par de 24 horas (saída igual à entrada)", { entrada: 480, saida: 480 }],
  ])("recusa %s", (_caso, invalido) => {
    const r = validarPares([invalido], 1);
    expect(!r.ok && r.error.code).toBe("VALIDATION_ERROR");
  });

  it("aceita a jornada que vira o dia (saída menor que a entrada)", () => {
    expect(validarPares([{ entrada: 1320, saida: 360 }], 1).ok).toBe(true);
  });
});
