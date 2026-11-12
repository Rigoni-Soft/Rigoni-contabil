import {
  convencaoDaEpoca,
  LEGISLACAO,
  regrasDeCalculo,
} from "@/modules/rh/domain/services/regras-de-calculo.service";
import {
  CHAVES_DE_REGRA,
  CHAVES_NO_CALCULO,
  type RegraAplicada,
  type RegrasDaConvencao,
} from "@/shared/kernel/regras-da-convencao";

const vazia: RegrasDaConvencao = { versao: 1, aplicadas: [], rejeitadas: [] };
const conv = (sindicato: string, vigenciaInicio: string, vigenciaFim: string) => ({
  sindicato,
  vigenciaInicio,
  vigenciaFim,
  regras: vazia,
});
const SEM = { bancoDeHoras: false, trabalhoAosDomingos: false };

// Um valor por chave, diferente da legislação; só as de CHAVES_NO_CALCULO podem mudar o resultado.
const AMOSTRA: Record<(typeof CHAVES_DE_REGRA)[number], RegraAplicada> = {
  jornada_semanal: { chave: "jornada_semanal", valor: 2400, clausula: "1ª", trecho: "40h" },
  jornada_diaria: { chave: "jornada_diaria", valor: 420, clausula: "1ª", trecho: "7h" },
  limite_extras_dia: { chave: "limite_extras_dia", valor: 60, clausula: "1ª", trecho: "1h" },
  intervalo_minimo: { chave: "intervalo_minimo", valor: 30, clausula: "1ª", trecho: "30" },
  intervalo_maximo: { chave: "intervalo_maximo", valor: 180, clausula: "1ª", trecho: "3h" },
  extra_sabado: { chave: "extra_sabado", valor: 60, clausula: "1ª", trecho: "60%" },
  datas_especiais: {
    chave: "datas_especiais",
    valor: [{ descricao: "Natal", data: "25/12", percentual: 150 }],
    clausula: "1ª",
    trecho: "25/12 150%",
  },
  excecoes_de_feriado: {
    chave: "excecoes_de_feriado",
    valor: [{ descricao: "Carnaval" }],
    clausula: "1ª",
    trecho: "Carnaval",
  },
};

describe("CHAVES_NO_CALCULO", () => {
  it.each(CHAVES_DE_REGRA)("%s muda o cálculo só se estiver na lista", (chave) => {
    const regras: RegrasDaConvencao = { versao: 1, aplicadas: [AMOSTRA[chave]], rejeitadas: [] };

    const muda = JSON.stringify(regrasDeCalculo(regras, SEM, false)) !== JSON.stringify(LEGISLACAO);

    expect(muda).toBe(CHAVES_NO_CALCULO.includes(chave));
  });
});

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
