import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { escopoDoUsuario, LOGO_DO_ESCRITORIO, LOGO_POR_SETOR } from "./escopo-do-usuario";

const PASTA_PUBLICA = join(process.cwd(), "public");

describe("logos", () => {
  it("a logo do escritório e cada logo do mapa existem em public/logos", () => {
    for (const caminho of [LOGO_DO_ESCRITORIO, ...Object.values(LOGO_POR_SETOR)]) {
      expect(existsSync(join(PASTA_PUBLICA, caminho))).toBe(true);
    }
  });

  it("não sobra arquivo em public/logos fora do mapa", () => {
    const usados = [LOGO_DO_ESCRITORIO, ...Object.values(LOGO_POR_SETOR)].map((c) =>
      c.replace("/logos/", ""),
    );

    expect(readdirSync(join(PASTA_PUBLICA, "logos")).sort()).toEqual(usados.sort());
  });
});

describe("escopoDoUsuario", () => {
  it("Setor com nome de propriedade de objeto ('constructor') cai na logo do escritório", () => {
    expect(escopoDoUsuario({ papel: "funcionario", setor: "constructor" }).logo).toBe(
      LOGO_DO_ESCRITORIO,
    );
  });

  it("Admin não tem Setor: vê todos os setores, volta a '/' e usa a logo do escritório, qualquer que seja o Setor da sessão", () => {
    for (const setor of ["administrativo", "rh", "simples_nacional"]) {
      expect(escopoDoUsuario({ papel: "admin", setor })).toEqual({
        rotulo: "Todos os setores",
        descricao: "acesso a todos os setores",
        home: "/",
        logo: LOGO_DO_ESCRITORIO,
      });
    }
  });

  it.each([
    ["simples_nacional", "Simples Nacional", "/simples-nacional"],
    ["rh", "RH", "/rh"],
  ])("Setor com dashboard (%s): rótulo, home própria", (setor, rotulo, home) => {
    for (const papel of ["lider_setor", "funcionario"]) {
      expect(escopoDoUsuario({ papel, setor })).toMatchObject({
        rotulo,
        descricao: `Setor: ${rotulo}`,
        home,
      });
    }
  });

  it.each([
    ["simples_nacional", "/logos/logo-simples-nacional.jpeg"],
    ["contabil", "/logos/logo-contabil.jpeg"],
  ])("Setor com logo (%s): usa a logo própria", (setor, logo) => {
    expect(escopoDoUsuario({ papel: "funcionario", setor }).logo).toBe(logo);
    expect(escopoDoUsuario({ papel: "lider_setor", setor }).logo).toBe(logo);
  });

  it.each([
    ["recepcao", "Recepção"],
    ["financeiro", "Financeiro"],
  ])("Setor sem logo (%s): home é '/' e a logo cai na do escritório", (setor, rotulo) => {
    expect(escopoDoUsuario({ papel: "funcionario", setor })).toEqual({
      rotulo,
      descricao: `Setor: ${rotulo}`,
      home: "/",
      logo: LOGO_DO_ESCRITORIO,
    });
  });

  it("slug desconhecido aparece cru, sem quebrar", () => {
    expect(escopoDoUsuario({ papel: "funcionario", setor: "novo" })).toMatchObject({
      rotulo: "novo",
      home: "/",
    });
  });
});
