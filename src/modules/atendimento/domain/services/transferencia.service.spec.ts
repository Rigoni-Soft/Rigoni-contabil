import type { Papel } from "@/shared/kernel/papeis";
import type { SetorSlug } from "@/shared/kernel/setores";

import {
  atendidoPeloSimplesNacional,
  podeAtender,
  podeSupervisionar,
  setoresDeDestino,
} from "./transferencia.service";

type Ator = { id: string; papel: Papel; setor: SetorSlug };

const atendimento = { setor: "recepcao" as const, funcionarioId: "dono" };

const ATORES: [string, Ator][] = [
  ["Admin", { id: "x", papel: "admin", setor: "contabil" }],
  ["Líder do Setor", { id: "x", papel: "lider_setor", setor: "recepcao" }],
  ["dono", { id: "dono", papel: "funcionario", setor: "recepcao" }],
  ["Líder de outro Setor", { id: "x", papel: "lider_setor", setor: "contabil" }],
  ["outro Funcionário", { id: "x", papel: "funcionario", setor: "recepcao" }],
];

describe("podeSupervisionar (ver e encerrar)", () => {
  it.each([
    ["Admin", true],
    ["Líder do Setor", true],
    ["dono", true],
    ["Líder de outro Setor", false],
    ["outro Funcionário", false],
  ])("%s → %s", (nome, esperado) => {
    const ator = ATORES.find(([n]) => n === nome)![1];
    expect(podeSupervisionar(ator, atendimento)).toBe(esperado);
  });
});

describe("podeAtender (responder, reagir, enviar e transferir)", () => {
  it.each([
    ["Admin", false],
    ["Líder do Setor", false],
    ["dono", true],
    ["Líder de outro Setor", false],
    ["outro Funcionário", false],
  ])("%s → %s", (nome, esperado) => {
    const ator = ATORES.find(([n]) => n === nome)![1];
    expect(podeAtender(ator, atendimento)).toBe(esperado);
  });

  it("espera (sem dono): ninguém atende, só Admin/Líder supervisionam", () => {
    const semDono = { setor: "recepcao" as const, funcionarioId: null };
    expect(podeAtender({ id: "x", papel: "funcionario", setor: "recepcao" }, semDono)).toBe(false);
    expect(podeSupervisionar({ id: "x", papel: "lider_setor", setor: "recepcao" }, semDono)).toBe(
      true,
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
