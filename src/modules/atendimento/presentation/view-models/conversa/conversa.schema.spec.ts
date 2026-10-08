import { atendimentoIdSchema, enviarDocumentoSchema } from "./conversa.schema";

const ID = "9f1c9c6e-9d1a-4c9a-8b1e-2e2a4a5b6c7d";

describe("atendimentoIdSchema", () => {
  it("aceita UUID e recusa texto livre", () => {
    expect(atendimentoIdSchema.safeParse(ID).success).toBe(true);
    expect(atendimentoIdSchema.safeParse("1").success).toBe(false);
  });
});

describe("enviarDocumentoSchema", () => {
  it("contrato sem data e alteração com data são válidos", () => {
    const contrato = { atendimentoId: ID, documento: { tipo: "contrato", data: null } };
    const alteracao = { atendimentoId: ID, documento: { tipo: "alteracao", data: "2026-03-01" } };
    expect(enviarDocumentoSchema.safeParse(contrato).success).toBe(true);
    expect(enviarDocumentoSchema.safeParse(alteracao).success).toBe(true);
  });

  it.each([
    [{ tipo: "contrato", data: "2026-03-01" }],
    [{ tipo: "alteracao", data: null }],
    [{ tipo: "alteracao", data: "01/03/2026" }],
    [{ tipo: "guia", data: null }],
  ])("recusa %p", (documento) => {
    expect(enviarDocumentoSchema.safeParse({ atendimentoId: ID, documento }).success).toBe(false);
  });
});
