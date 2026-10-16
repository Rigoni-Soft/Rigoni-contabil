import { editarCadastroOperacionalSchema } from "./editar-cadastro-operacional.schema";

const CLIENTE_ID = "123e4567-e89b-42d3-a456-426614174000";

function payloadValido() {
  return {
    clienteId: CLIENTE_ID,
    formaEnvio: "whatsapp",
    contatos: [{ nome: "Maria", telefone: "11999998888", padrao: true }],
    documentoObrigatorio: "positivo",
    dasStatus: "pronto",
    dataEnvioDas: "2026-02-01",
    temParcelamento: false,
    parcelamentoStatus: null,
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
