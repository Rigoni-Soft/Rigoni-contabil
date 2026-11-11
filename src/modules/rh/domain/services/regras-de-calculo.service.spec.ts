import {
  convencaoDaEpoca,
  LEGISLACAO,
  regrasDeCalculo,
} from "@/modules/rh/domain/services/regras-de-calculo.service";
import type { RegrasDaConvencao } from "@/shared/kernel/regras-da-convencao";

const vazia: RegrasDaConvencao = { versao: 1, aplicadas: [], rejeitadas: [] };
const conv = (sindicato: string, vigenciaInicio: string, vigenciaFim: string) => ({
  sindicato,
  vigenciaInicio,
  vigenciaFim,
  regras: vazia,
});
const SEM = { bancoDeHoras: false, trabalhoAosDomingos: false };

describe("regrasDeCalculo", () => {
  it("sem convenção vale a legislação, com os interruptores do Cliente", () => {
    expect(regrasDeCalculo(null, SEM, false)).toEqual(LEGISLACAO);
    expect(
      regrasDeCalculo(null, { bancoDeHoras: true, trabalhoAosDomingos: false }, false),
    ).toEqual({ ...LEGISLACAO, bancoDeHoras: true });
  });

  it("regra que a convenção não traz fica com a legislação", () => {
    const r = regrasDeCalculo(
      {
        ...vazia,
        aplicadas: [{ chave: "extra_sabado", valor: 60, clausula: "12ª", trecho: "60%" }],
      },
      SEM,
      false,
    );
    expect(r).toEqual({ ...LEGISLACAO, extraSabadoPct: 60 });
  });
});

describe("convencaoDaEpoca", () => {
  const a = conv("Comerciários", "2025-01-01", "2025-12-31");
  const b = conv("Comerciários", "2026-01-01", "2026-12-31");
  const outro = conv("Bancários", "2026-01-01", "2026-12-31");

  it("cartão de data anterior usa a convenção da época", () => {
    expect(convencaoDaEpoca([a, b], null, "2025-11-10")).toBe(a);
    expect(convencaoDaEpoca([a, b], null, "2026-11-10")).toBe(b);
  });

  it("fora de qualquer vigência não há convenção", () => {
    expect(convencaoDaEpoca([a, b], null, "2027-01-01")).toBeNull();
    expect(convencaoDaEpoca([], null, "2026-11-10")).toBeNull();
  });

  it("o empregado que aponta um sindicato usa o dele", () => {
    expect(convencaoDaEpoca([b, outro], "Bancários", "2026-11-10")).toBe(outro);
  });

  it("sem ponteiro e com dois sindicatos vigentes não há como escolher", () => {
    expect(convencaoDaEpoca([b, outro], null, "2026-11-10")).toBeNull();
  });

  it("renovação sobreposta do mesmo sindicato: vale a de vigência mais recente", () => {
    const adit = conv("Comerciários", "2026-06-01", "2027-05-31");
    expect(convencaoDaEpoca([b, adit], null, "2026-11-10")).toBe(adit);
  });
});
