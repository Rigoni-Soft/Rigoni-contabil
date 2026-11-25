import { listaDeSetores, setoresDaUra } from "./setores-da-ura.service";

describe("setoresDaUra", () => {
  it("nunca oferece a Recepção (ela é a saída de quem não escolhe)", () => {
    expect(setoresDaUra("simples_nacional")).not.toContain("recepcao");
    expect(setoresDaUra(null)).not.toContain("recepcao");
  });

  it.each(["simples_nacional", "mei"])("Cliente %s vê o Simples Nacional", (regime) => {
    expect(setoresDaUra(regime)).toContain("simples_nacional");
  });

  it.each(["lucro_presumido", "lucro_real", null])(
    "Cliente %p não vê o Simples Nacional",
    (regime) => {
      expect(setoresDaUra(regime)).not.toContain("simples_nacional");
    },
  );

  it("oferece os demais setores do organograma", () => {
    expect(setoresDaUra("mei")).toEqual([
      "rh",
      "tributario",
      "simples_nacional",
      "contabil",
      "societario",
      "condominios",
      "financeiro",
      "administrativo",
    ]);
  });
});

describe("listaDeSetores", () => {
  const oito = setoresDaUra("mei");

  it("primeira página: numera de 1, convida a ver mais e oferece a recepção e o menu", () => {
    expect(listaDeSetores(oito, 1)).toBe(
      [
        "Com qual setor você quer falar? (página 1 de 2)",
        "1 - RH",
        "2 - Tributário",
        "3 - Simples Nacional",
        "4 - Contábil",
        "5 - Societário",
        "Digite *mais* para ver as próximas.",
        "Digite *0* se não souber o setor, para falar com a recepção.",
        "Digite *menu* para voltar.",
      ].join("\n"),
    );
  });

  it("última página: numeração recomeça em 1 e não convida a ver mais", () => {
    const texto = listaDeSetores(oito, 2);

    expect(texto).toContain(
      "(página 2 de 2)\n1 - Condomínios\n2 - Financeiro\n3 - Administrativo\n",
    );
    expect(texto).not.toContain("*mais*");
  });
});
