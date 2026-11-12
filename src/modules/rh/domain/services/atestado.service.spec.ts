import { abonosDoAtestado, validarAtestado } from "@/modules/rh/domain/services/atestado.service";
import type { Jornada } from "@/modules/rh/domain/services/totalizacao.service";

// Segunda a sexta 8h45, sábado 4h, domingo folga.
const jornada = [0, 525, 525, 525, 525, 525, 240] as unknown as Jornada;

describe("validarAtestado", () => {
  it("aceita o atestado com período e nome", () => {
    const r = validarAtestado({
      nome: "Roberto Carlos Von Scharten",
      tipo: "atestado",
      de: "2026-08-23",
      ate: "2026-08-24",
    });
    expect(r.ok && r.value).toEqual({
      nome: "Roberto Carlos Von Scharten",
      tipo: "atestado",
      de: "2026-08-23",
      ate: "2026-08-24",
    });
  });

  it("declaração vale só a data inicial, mesmo que o modelo traga outra no fim", () => {
    const r = validarAtestado({
      nome: "Laura",
      tipo: "declaracao",
      de: "2026-08-27",
      ate: "2026-08-28",
    });
    expect(r.ok && r.value.ate).toBe("2026-08-27");
  });

  it.each([
    ["nome ilegível", { nome: null, de: "2026-08-23", ate: "2026-08-24" }],
    ["data que não existe", { nome: "Laura", de: "2026-02-31", ate: "2026-03-01" }],
    ["data ausente", { nome: "Laura", de: null, ate: null }],
    ["período invertido", { nome: "Laura", de: "2026-08-24", ate: "2026-08-23" }],
    ["período de mais de 31 dias", { nome: "Laura", de: "2026-08-01", ate: "2026-09-15" }],
  ])("recusa %s", (_, dados) => {
    expect(validarAtestado({ tipo: "atestado", ...dados }).ok).toBe(false);
  });
});

describe("abonosDoAtestado", () => {
  const atestado = {
    nome: "Roberto",
    tipo: "atestado" as const,
    de: "2026-08-21",
    ate: "2026-08-25",
  };

  it("atestado abona os dias de trabalho vazios cobertos; fim de semana sem carga fica de fora", () => {
    // 21/08 sex, 22 sáb, 23 dom, 24 seg, 25 ter.
    expect(abonosDoAtestado(atestado, jornada, new Set())).toEqual([
      "2026-08-21",
      "2026-08-22",
      "2026-08-24",
      "2026-08-25",
    ]);
  });

  it("atestado não mexe no dia que já tem batida", () => {
    expect(abonosDoAtestado(atestado, jornada, new Set(["2026-08-21", "2026-08-24"]))).toEqual([
      "2026-08-22",
      "2026-08-25",
    ]);
  });

  it("declaração de comparecimento abona só o horário: o dia com batida, nunca o dia vazio", () => {
    const declaracao = {
      nome: "Laura",
      tipo: "declaracao" as const,
      de: "2026-08-27",
      ate: "2026-08-27",
    };
    expect(abonosDoAtestado(declaracao, jornada, new Set(["2026-08-27"]))).toEqual(["2026-08-27"]);
    expect(abonosDoAtestado(declaracao, jornada, new Set())).toEqual([]);
  });
});
