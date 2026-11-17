import { escopoDoUsuario, LOGO_DO_ESCRITORIO } from "./escopo-do-usuario";

describe("escopoDoUsuario", () => {
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
    ["contabil", "Contábil"],
    ["recepcao", "Recepção"],
    ["financeiro", "Financeiro"],
  ])("Setor sem tela própria (%s): home é '/' e a logo cai na do escritório", (setor, rotulo) => {
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
