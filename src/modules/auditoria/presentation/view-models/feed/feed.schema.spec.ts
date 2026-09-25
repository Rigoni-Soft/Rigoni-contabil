import { filtroFeedSchema } from "./feed.schema";

describe("filtroFeedSchema", () => {
  it('aceita "" nos campos de data e resultado (valor padrão de input/select vazios)', () => {
    const resultado = filtroFeedSchema.safeParse({
      dataInicio: "",
      dataFim: "",
      resultado: "",
      setor: "",
    });

    expect(resultado.success).toBe(true);
  });

  it("aceita um filtro totalmente preenchido", () => {
    const resultado = filtroFeedSchema.safeParse({
      dataInicio: "2026-09-01",
      dataFim: "2026-09-22",
      setor: "administrativo",
      ator: "11111111-1111-1111-1111-111111111111",
      acao: "usuario.criar",
      alvo: "jessica",
      resultado: "sucesso",
    });

    expect(resultado.success).toBe(true);
  });

  it("rejeita quando dataInicio é depois de dataFim", () => {
    const resultado = filtroFeedSchema.safeParse({
      dataInicio: "2026-09-22",
      dataFim: "2026-09-01",
    });

    expect(resultado.success).toBe(false);
  });

  it("rejeita um resultado fora de sucesso/falha", () => {
    const resultado = filtroFeedSchema.safeParse({ resultado: "parcial" });

    expect(resultado.success).toBe(false);
  });
});
