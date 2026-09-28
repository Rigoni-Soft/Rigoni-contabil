import { Cliente } from "@/modules/clientes/domain/entities/cliente.entity";

const CNPJ_VALIDO = "11444777000161";

describe("ClienteBuilder", () => {
  it("constrói um Cliente válido, com alterações contratuais", () => {
    const resultado = Cliente.builder()
      .comId("11111111-1111-1111-1111-111111111111")
      .comEmpresa("Padaria Pão Quente Ltda")
      .comCnpj(CNPJ_VALIDO)
      .comRegime("simples_nacional")
      .comContratoSocialCaminho("clientes/1/contrato-social/doc.pdf")
      .comAlteracoesContratuais([
        { data: "2026-02-01", arquivoCaminho: "clientes/1/alteracoes/0-doc.pdf" },
      ])
      .build();

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.value.empresa).toBe("Padaria Pão Quente Ltda");
      expect(resultado.value.cnpj.digitos).toBe(CNPJ_VALIDO);
      expect(resultado.value.regime.valor).toBe("simples_nacional");
      expect(resultado.value.alteracoesContratuais).toHaveLength(1);
    }
  });

  it("constrói um Cliente válido sem nenhuma alteração contratual", () => {
    const resultado = Cliente.builder()
      .comId("11111111-1111-1111-1111-111111111111")
      .comEmpresa("Padaria Pão Quente Ltda")
      .comCnpj(CNPJ_VALIDO)
      .comRegime("simples_nacional")
      .comContratoSocialCaminho("clientes/1/contrato-social/doc.pdf")
      .comAlteracoesContratuais([])
      .build();

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.value.alteracoesContratuais).toEqual([]);
  });

  it("acumula erros de empresa vazia, CNPJ e regime inválidos, e contrato social ausente", () => {
    const resultado = Cliente.builder()
      .comId("11111111-1111-1111-1111-111111111111")
      .comEmpresa("")
      .comCnpj("123")
      .comRegime("lucro_arbitrado")
      .comContratoSocialCaminho("")
      .comAlteracoesContratuais([])
      .build();

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(Object.keys(resultado.error.fields ?? {})).toEqual(
        expect.arrayContaining(["empresa", "cnpj", "regime", "contratoSocial"]),
      );
    }
  });

  it("acumula erro quando uma alteração contratual tem data inválida", () => {
    const resultado = Cliente.builder()
      .comId("11111111-1111-1111-1111-111111111111")
      .comEmpresa("Padaria Pão Quente Ltda")
      .comCnpj(CNPJ_VALIDO)
      .comRegime("simples_nacional")
      .comContratoSocialCaminho("clientes/1/contrato-social/doc.pdf")
      .comAlteracoesContratuais([{ data: "data-invalida", arquivoCaminho: "doc.pdf" }])
      .build();

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.fields?.alteracoesContratuais?.[0]).toContain("item 1");
    }
  });

  it("restaurar reconstitui a partir de dados persistidos", () => {
    const resultado = Cliente.builder()
      .restaurar({
        id: "11111111-1111-1111-1111-111111111111",
        empresa: "Padaria Pão Quente Ltda",
        cnpj: CNPJ_VALIDO,
        regime: "simples_nacional",
        contratoSocialCaminho: "clientes/1/contrato-social/doc.pdf",
        alteracoesContratuais: [
          { data: "2026-02-01", arquivoCaminho: "clientes/1/alteracoes/0-doc.pdf" },
        ],
      })
      .build();

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.value.alteracoesContratuais).toHaveLength(1);
  });
});
