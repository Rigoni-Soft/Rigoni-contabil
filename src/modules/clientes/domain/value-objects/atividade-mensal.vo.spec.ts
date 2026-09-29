import { AtividadeMensal } from "./atividade-mensal.vo";

describe("AtividadeMensal", () => {
  it("cria uma atividade mensal com as 3 flags independentes", () => {
    const resultado = AtividadeMensal.criar({
      anoMes: "2026-09",
      industria: false,
      comercio: true,
      servico: false,
    });

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.value.anoMes).toBe("2026-09");
      expect(resultado.value.industria).toBe(false);
      expect(resultado.value.comercio).toBe(true);
      expect(resultado.value.servico).toBe(false);
    }
  });

  it("aceita nenhuma atividade marcada (todas false)", () => {
    const resultado = AtividadeMensal.criar({
      anoMes: "2026-09",
      industria: false,
      comercio: false,
      servico: false,
    });

    expect(resultado.ok).toBe(true);
  });

  it("aceita múltiplas atividades marcadas ao mesmo tempo (flags não são mutuamente exclusivas)", () => {
    const resultado = AtividadeMensal.criar({
      anoMes: "2026-09",
      industria: true,
      comercio: true,
      servico: true,
    });

    expect(resultado.ok).toBe(true);
  });
});
