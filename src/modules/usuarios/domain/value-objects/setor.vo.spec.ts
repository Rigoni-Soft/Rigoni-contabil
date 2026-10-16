import { Setor } from "./setor.vo";

describe("Setor", () => {
  it("cria um setor válido", () => {
    const resultado = Setor.criar("simples_nacional");

    expect(resultado.ok).toBe(true);
  });

  it("rejeita um setor desconhecido (ex.: patriki, expedicao)", () => {
    expect(Setor.criar("patriki").ok).toBe(false);
    expect(Setor.criar("expedicao").ok).toBe(false);
  });

  it("dois setores com o mesmo slug são iguais por valor", () => {
    const a = Setor.criar("recepcao");
    const b = Setor.criar("recepcao");

    expect(a.ok && b.ok && a.value.slug === b.value.slug).toBe(true);
  });
});
