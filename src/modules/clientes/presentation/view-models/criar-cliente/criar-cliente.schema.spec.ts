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
      alteracoesContratuais: [{ numero: 1, data: "2026-02-01", arquivo: arquivo() }],
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

  it.each([[undefined], [""], ["financeiro@padaria.com.br"]])(
    "e-mail opcional: aceita %p",
    (email) => {
      const resultado = criarClienteSchema.safeParse({
        empresa: "Padaria Pão Quente Ltda",
        cnpj: "11.444.777/0001-61",
        regime: "simples_nacional",
        email,
        alteracoesContratuais: [],
      });
      expect(resultado.success).toBe(true);
    },
  );

  it("rejeita e-mail acima de 254 caracteres", () => {
    const resultado = criarClienteSchema.safeParse({
      empresa: "Padaria Pão Quente Ltda",
      cnpj: "11.444.777/0001-61",
      regime: "simples_nacional",
      email: `${"a".repeat(250)}@b.co`,
      alteracoesContratuais: [],
    });
    expect(resultado.success).toBe(false);
  });

  it("rejeita e-mail mal formado", () => {
    const resultado = criarClienteSchema.safeParse({
      empresa: "Padaria Pão Quente Ltda",
      cnpj: "11.444.777/0001-61",
      regime: "simples_nacional",
      email: "sem-arroba",
      alteracoesContratuais: [],
    });
    expect(resultado.success).toBe(false);
  });

  describe("nº da alteração", () => {
    const base = {
      empresa: "Padaria Pão Quente Ltda",
      cnpj: "11.444.777/0001-61",
      regime: "simples_nacional",
    };
    const alteracao = (numero: number) => ({ numero, data: "2026-02-01", arquivo: arquivo() });

    it("barra nº repetido no formulário, apontando a alteração repetida", () => {
      const resultado = criarClienteSchema.safeParse({
        ...base,
        alteracoesContratuais: [alteracao(1), alteracao(1)],
      });

      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        expect(resultado.error.issues.map((i) => [i.path.join("."), i.message])).toEqual([
          ["alteracoesContratuais.0.numero", "Já existe a alteração nº 1"],
          ["alteracoesContratuais.1.numero", "Já existe a alteração nº 1"],
        ]);
      }
    });

    it.each([0, -2, 1.5, Number.NaN])("recusa o nº %s", (numero) => {
      const resultado = criarClienteSchema.safeParse({
        ...base,
        alteracoesContratuais: [alteracao(numero)],
      });

      expect(resultado.success).toBe(false);
    });
  });
});
