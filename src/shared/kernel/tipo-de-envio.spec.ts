import { porOrdemDosTiposDeEnvio } from "./tipo-de-envio";

const tipo = (slug: string) => ({ slug, rotulo: slug });

describe("porOrdemDosTiposDeEnvio", () => {
  it("segue a ordem de negócio, não a ordem em que o banco devolveu", () => {
    const doBanco = ["avisos", "guia_parcelamento", "das", "lembrete_documento"].map(tipo);

    expect(porOrdemDosTiposDeEnvio(doBanco).map((t) => t.slug)).toEqual([
      "lembrete_documento",
      "das",
      "guia_parcelamento",
      "avisos",
    ]);
  });

  it("tipo fora da lista vai para o fim, sem perder nenhum", () => {
    const resultado = porOrdemDosTiposDeEnvio(["novo", "das"].map(tipo));

    expect(resultado.map((t) => t.slug)).toEqual(["das", "novo"]);
  });

  it("não altera a lista recebida", () => {
    const original = ["das", "lembrete_documento"].map(tipo);

    porOrdemDosTiposDeEnvio(original);

    expect(original.map((t) => t.slug)).toEqual(["das", "lembrete_documento"]);
  });
});
