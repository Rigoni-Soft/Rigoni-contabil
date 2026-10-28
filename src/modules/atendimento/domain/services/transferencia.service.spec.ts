import type { Papel } from "@/shared/kernel/papeis";
import type { SetorSlug } from "@/shared/kernel/setores";

import {
  atendidoPeloSimplesNacional,
  podeTransferir,
  setoresDeDestino,
} from "./transferencia.service";

type Ator = { id: string; papel: Papel; setor: SetorSlug };

const atendimento = { setor: "recepcao" as const, funcionarioId: "dono" };

describe("podeTransferir", () => {
  it.each<[Ator, boolean]>([
    [{ id: "x", papel: "admin", setor: "contabil" }, true],
    [{ id: "x", papel: "lider_setor", setor: "recepcao" }, true],
    [{ id: "dono", papel: "funcionario", setor: "recepcao" }, true],
    [{ id: "x", papel: "lider_setor", setor: "contabil" }, false],
    [{ id: "x", papel: "funcionario", setor: "recepcao" }, false],
  ])("%j → %s", (ator, esperado) => {
    expect(podeTransferir(ator, atendimento)).toBe(esperado);
  });

  it("Atendimento sem dono só é transferido por Admin ou Líder", () => {
    const semDono = { setor: "recepcao" as const, funcionarioId: null };
    expect(podeTransferir({ id: "x", papel: "funcionario", setor: "recepcao" }, semDono)).toBe(
      false,
    );
  });
});

describe("atendidoPeloSimplesNacional", () => {
  it.each([
    ["simples_nacional", true],
    ["mei", true],
    ["lucro_presumido", false],
    ["lucro_real", false],
  ])("%s → %s", (regime, esperado) => {
    expect(atendidoPeloSimplesNacional(regime)).toBe(esperado);
  });
});

describe("setoresDeDestino", () => {
  it("lista todos os Setores menos o de origem", () => {
    const destinos = setoresDeDestino("contabil", "lucro_presumido");
    expect(destinos).not.toContain("contabil");
    expect(destinos).toContain("recepcao");
    expect(destinos).toHaveLength(7);
  });

  it("Simples Nacional só é destino para Cliente do Simples Nacional ou MEI", () => {
    expect(setoresDeDestino("contabil", "simples_nacional")).toContain("simples_nacional");
    expect(setoresDeDestino("contabil", "mei")).toContain("simples_nacional");
    expect(setoresDeDestino("contabil", "lucro_real")).not.toContain("simples_nacional");
    expect(setoresDeDestino("contabil", null)).not.toContain("simples_nacional");
  });

  it("a origem sai mesmo sendo o Simples Nacional", () => {
    expect(setoresDeDestino("simples_nacional", "mei")).not.toContain("simples_nacional");
  });
});
