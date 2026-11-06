import { ondeAtribuirResponsavel } from "./responsavel-do-setor.presenter";

describe("ondeAtribuirResponsavel", () => {
  it("Simples Nacional atribui no cadastro, não no bloco do Setor", () => {
    expect(ondeAtribuirResponsavel("lider_setor", "simples_nacional")).toEqual({
      noCadastro: true,
      noSetor: false,
    });
  });

  it("Líder de outro Setor atribui no bloco do Setor", () => {
    expect(ondeAtribuirResponsavel("lider_setor", "contabil")).toEqual({
      noCadastro: false,
      noSetor: true,
    });
  });

  it("Funcionário, recepção e Admin (sem Setor) não atribuem no bloco", () => {
    expect(ondeAtribuirResponsavel("funcionario", "contabil").noSetor).toBe(false);
    expect(ondeAtribuirResponsavel("lider_setor", "recepcao").noSetor).toBe(false);
    expect(ondeAtribuirResponsavel("admin", "").noSetor).toBe(false);
  });
});
