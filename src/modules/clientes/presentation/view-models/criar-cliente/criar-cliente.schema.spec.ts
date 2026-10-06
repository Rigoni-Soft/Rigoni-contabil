import { criarClienteSchema } from "./criar-cliente.schema";

function arquivo(): File {
  return new File(["conteúdo"], "doc.pdf", { type: "application/pdf" });
}

describe("criarClienteSchema", () => {
  it("aceita dados válidos, com uma alteração contratual", () => {
    const resultado = criarClienteSchema.safeParse({
      empresa: "Padaria Pão Quente Ltda",
      cnpj: "11.444.777/0001-61",
      regime: "simples_nacional",
      contratoSocial: arquivo(),
      alteracoesContratuais: [{ data: "2026-02-01", arquivo: arquivo() }],
    });

    expect(resultado.success).toBe(true);
  });

  it("aceita dados válidos sem nenhuma alteração contratual", () => {
    const resultado = criarClienteSchema.safeParse({
      empresa: "Padaria Pão Quente Ltda",
      cnpj: "11.444.777/0001-61",
      regime: "simples_nacional",
      contratoSocial: arquivo(),
      alteracoesContratuais: [],
    });

    expect(resultado.success).toBe(true);
  });

  it("rejeita empresa vazia, regime desconhecido e contrato social ausente", () => {
    const resultado = criarClienteSchema.safeParse({
      empresa: "",
      cnpj: "11.444.777/0001-61",
      regime: "lucro_arbitrado",
      contratoSocial: undefined,
      alteracoesContratuais: [],
    });

    expect(resultado.success).toBe(false);
  });
});
