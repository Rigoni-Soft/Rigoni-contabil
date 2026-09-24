import { ListarSetores } from "./listar-setores.use-case";

describe("ListarSetores", () => {
  it("lista os setores do organograma, exceto Patriki e Expedição", async () => {
    const setores = await new ListarSetores().execute();
    const slugs = setores.map((s) => s.slug);

    expect(slugs).toContain("simples_nacional");
    expect(slugs).toContain("tributario");
    expect(slugs).not.toContain("patriki");
    expect(slugs).not.toContain("expedicao");
  });
});
