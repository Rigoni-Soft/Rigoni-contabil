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
      expect(resultado.value.cnpj.valor).toBe(CNPJ_VALIDO);
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

  it("acumula erros de empresa vazia, CNPJ e regime inválidos", () => {
    const resultado = Cliente.builder()
      .comId("11111111-1111-1111-1111-111111111111")
      .comEmpresa("")
      .comCnpj("123")
      .comRegime("lucro_arbitrado")
      .comContratoSocialCaminho(null)
      .comAlteracoesContratuais([])
      .build();

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(Object.keys(resultado.error.fields ?? {})).toEqual(
        expect.arrayContaining(["empresa", "cnpj", "regime"]),
      );
    }
  });

  it("aceita Cliente sem contrato social (campo opcional, decisão de produto 2026-09-29)", () => {
    const resultado = Cliente.builder()
      .comId("11111111-1111-1111-1111-111111111111")
      .comEmpresa("Padaria Pão Quente Ltda")
      .comCnpj(CNPJ_VALIDO)
      .comRegime("simples_nacional")
      .comContratoSocialCaminho(null)
      .comAlteracoesContratuais([])
      .build();

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.value.contratoSocialCaminho).toBeNull();
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

  it("rejeita quando um campo obrigatório nunca teve seu setter chamado (devolutiva #55, ponto 03)", () => {
    const resultado = Cliente.builder().comId("11111111-1111-1111-1111-111111111111").build();

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(Object.keys(resultado.error.fields ?? {})).toEqual(
        expect.arrayContaining(["empresa", "cnpj", "regime"]),
      );
    }
  });

  it("preserva a mensagem específica de CNPJ/regime inválidos em vez do genérico 'obrigatório'", () => {
    const resultado = Cliente.builder()
      .comId("11111111-1111-1111-1111-111111111111")
      .comEmpresa("Padaria Pão Quente Ltda")
      .comCnpj("123")
      .comRegime("lucro_arbitrado")
      .comContratoSocialCaminho("clientes/1/contrato-social/doc.pdf")
      .comAlteracoesContratuais([])
      .build();

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.fields?.cnpj).not.toEqual(["obrigatório"]);
      expect(resultado.error.fields?.regime).not.toEqual(["obrigatório"]);
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
