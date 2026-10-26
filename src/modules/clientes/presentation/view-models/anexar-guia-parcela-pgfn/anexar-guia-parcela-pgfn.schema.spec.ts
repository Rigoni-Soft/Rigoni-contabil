import { anexarGuiaParcelaPgfnSchema } from "./anexar-guia-parcela-pgfn.schema";

const pdf = (tamanho = 10, tipo = "application/pdf") =>
  new File([new Uint8Array(tamanho)], "guia.pdf", { type: tipo });

const base = {
  parcelamentoId: "11111111-1111-4111-8111-111111111111",
  competencia: "202610",
  contaNegociacao: " 123456 ",
  arquivo: pdf(),
};

describe("anexarGuiaParcelaPgfnSchema", () => {
  it("aceita e apara a conta de negociação", () => {
    const r = anexarGuiaParcelaPgfnSchema.safeParse(base);
    expect(r.success && r.data.contaNegociacao).toBe("123456");
  });

  it.each(["", "2026-10", "202613"])("recusa a competência %p", (competencia) => {
    expect(anexarGuiaParcelaPgfnSchema.safeParse({ ...base, competencia }).success).toBe(false);
  });

  it.each(["", "   ", "9".repeat(41)])("recusa a conta %p", (contaNegociacao) => {
    expect(anexarGuiaParcelaPgfnSchema.safeParse({ ...base, contaNegociacao }).success).toBe(false);
  });

  it("recusa arquivo que não é PDF ou passa de 4 MB, aceita exatamente 4 MB", () => {
    const tentar = (arquivo: File) => anexarGuiaParcelaPgfnSchema.safeParse({ ...base, arquivo });
    expect(tentar(pdf(10, "image/png")).success).toBe(false);
    expect(tentar(pdf(4 * 1024 * 1024 + 1)).success).toBe(false);
    expect(tentar(pdf(4 * 1024 * 1024)).success).toBe(true);
  });
});
