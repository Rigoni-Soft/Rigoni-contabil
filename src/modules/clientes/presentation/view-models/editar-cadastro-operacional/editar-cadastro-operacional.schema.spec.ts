import {
  editarCadastroOperacionalSchema,
  salvarParcelamentosSchema,
} from "./editar-cadastro-operacional.schema";

const CLIENTE_ID = "123e4567-e89b-42d3-a456-426614174000";

function payloadValido() {
  return {
    clienteId: CLIENTE_ID,
    formaEnvio: "whatsapp",
    contatos: [{ nome: "Maria", telefone: "11999998888", padrao: true }],
    documentoObrigatorio: "positivo",
    dasStatus: "pronto",
    dataEnvioDas: "2026-02-01",
    observacoesGerais: "",
    atividadeMes: { industria: false, comercio: true, servico: false },
  };
}

describe("editarCadastroOperacionalSchema", () => {
  it("aceita um payload válido completo", () => {
    const resultado = editarCadastroOperacionalSchema.safeParse(payloadValido());

    expect(resultado.success).toBe(true);
  });

  it("rejeita clienteId que não é UUID", () => {
    const resultado = editarCadastroOperacionalSchema.safeParse({
      ...payloadValido(),
      clienteId: "não-e-uuid",
    });

    expect(resultado.success).toBe(false);
  });

  it("rejeita formaEnvio fora do enum", () => {
    const resultado = editarCadastroOperacionalSchema.safeParse({
      ...payloadValido(),
      formaEnvio: "carta",
    });

    expect(resultado.success).toBe(false);
  });

  it("rejeita um contato com nome vazio", () => {
    const resultado = editarCadastroOperacionalSchema.safeParse({
      ...payloadValido(),
      contatos: [{ nome: "", telefone: "11999998888", padrao: true }],
    });

    expect(resultado.success).toBe(false);
  });

  it("rejeita um contato com telefone vazio", () => {
    const resultado = editarCadastroOperacionalSchema.safeParse({
      ...payloadValido(),
      contatos: [{ nome: "Maria", telefone: "", padrao: true }],
    });

    expect(resultado.success).toBe(false);
  });

  it("rejeita dataEnvioDas que não é data ISO", () => {
    const resultado = editarCadastroOperacionalSchema.safeParse({
      ...payloadValido(),
      dataEnvioDas: "ontem",
    });

    expect(resultado.success).toBe(false);
  });
});

describe("salvarParcelamentosSchema", () => {
  const pdfDe = (mib: number) =>
    new File([new Uint8Array(mib * 1024 * 1024)], "a.pdf", { type: "application/pdf" });
  const linha = (codigo: string, mib: number) => ({
    codigo,
    parcelasRestantes: 3,
    interno: false,
    arquivo: pdfDe(mib),
  });

  it("dois PDFs de 3 MiB passam cada um sob o teto, mas a soma não cabe no corpo da requisição", () => {
    const um = salvarParcelamentosSchema.safeParse({
      clienteId: CLIENTE_ID,
      parcelamentos: [linha("A", 3)],
    });
    const dois = salvarParcelamentosSchema.safeParse({
      clienteId: CLIENTE_ID,
      parcelamentos: [linha("A", 3), linha("B", 3)],
    });

    expect(um.success).toBe(true);
    expect(dois.success).toBe(false);
    expect(!dois.success && dois.error.issues[0].message).toMatch(/somam mais de 4 MB/);
  });
});
