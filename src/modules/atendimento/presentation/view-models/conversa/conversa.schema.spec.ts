import {
  atendimentoIdSchema,
  enviarDocumentoSchema,
  enviarMensagemSchema,
  reagirAMensagemSchema,
  transferirAtendimentoSchema,
} from "./conversa.schema";

const ID = "9f1c9c6e-9d1a-4c9a-8b1e-2e2a4a5b6c7d";

describe("atendimentoIdSchema", () => {
  it("aceita UUID e recusa texto livre", () => {
    expect(atendimentoIdSchema.safeParse(ID).success).toBe(true);
    expect(atendimentoIdSchema.safeParse("1").success).toBe(false);
  });
});

describe("enviarDocumentoSchema", () => {
  it("contrato sem nº e alteração com nº são válidos", () => {
    const contrato = { atendimentoId: ID, documento: { tipo: "contrato", numero: null } };
    const alteracao = { atendimentoId: ID, documento: { tipo: "alteracao", numero: 3 } };
    expect(enviarDocumentoSchema.safeParse(contrato).success).toBe(true);
    expect(enviarDocumentoSchema.safeParse(alteracao).success).toBe(true);
  });

  it.each(["das", "parcelamento", "cnd"])("guia %s não tem nº e é válida", (tipo) => {
    const guia = { atendimentoId: ID, documento: { tipo, numero: null } };
    expect(enviarDocumentoSchema.safeParse(guia).success).toBe(true);
  });

  it.each([
    [{ tipo: "contrato", numero: 3 }],
    [{ tipo: "alteracao", numero: null }],
    [{ tipo: "alteracao", numero: 0 }],
    [{ tipo: "das", numero: 3 }],
    [{ tipo: "guia", numero: null }],
  ])("recusa %p", (documento) => {
    expect(enviarDocumentoSchema.safeParse({ atendimentoId: ID, documento }).success).toBe(false);
  });
});

describe("transferirAtendimentoSchema", () => {
  it("aceita Setor e resumo, aparando espaços", () => {
    const r = transferirAtendimentoSchema.safeParse({
      atendimentoId: ID,
      setorDestino: "tributario",
      resumo: "  DAS em atraso  ",
    });
    expect(r.success && r.data.resumo).toBe("DAS em atraso");
  });

  it.each([
    [{ setorDestino: "", resumo: "x" }],
    [{ setorDestino: "ti", resumo: "x" }],
    [{ setorDestino: "tributario", resumo: "   " }],
    [{ setorDestino: "tributario", resumo: "x".repeat(1001) }],
  ])("recusa %p", (dados) => {
    expect(transferirAtendimentoSchema.safeParse({ atendimentoId: ID, ...dados }).success).toBe(
      false,
    );
  });
});

describe("enviarMensagemSchema", () => {
  it("aceita o texto, aparando espaços", () => {
    const r = enviarMensagemSchema.safeParse({ atendimentoId: ID, texto: "  oi  " });
    expect(r.success && r.data.texto).toBe("oi");
  });

  it("conta emoji como um caractere (limite por ponto de código)", () => {
    const aceita = enviarMensagemSchema.safeParse({ atendimentoId: ID, texto: "😀".repeat(4096) });
    const recusa = enviarMensagemSchema.safeParse({ atendimentoId: ID, texto: "😀".repeat(4097) });
    expect([aceita.success, recusa.success]).toEqual([true, false]);
  });

  it.each([[""], ["   "], ["x".repeat(4097)]])("recusa %p", (texto) => {
    expect(enviarMensagemSchema.safeParse({ atendimentoId: ID, texto }).success).toBe(false);
  });
});

describe("reagirAMensagemSchema", () => {
  it("aceita emoji composto e recusa mensagem fora do formato de id ou emoji vazio", () => {
    const base = { atendimentoId: ID, mensagemId: ID };
    expect(reagirAMensagemSchema.safeParse({ ...base, emoji: "👨‍👩‍👧" }).success).toBe(true);
    expect(
      reagirAMensagemSchema.safeParse({ ...base, mensagemId: "m1", emoji: "👍" }).success,
    ).toBe(false);
    expect(reagirAMensagemSchema.safeParse({ ...base, emoji: "  " }).success).toBe(false);
  });
});
