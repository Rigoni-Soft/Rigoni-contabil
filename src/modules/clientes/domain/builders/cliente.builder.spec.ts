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

  it("aceita Cliente sem nenhum campo operacional informado (defaults: whatsapp, sem parcelamento, sem observações)", () => {
    const resultado = Cliente.builder()
      .comId("11111111-1111-1111-1111-111111111111")
      .comEmpresa("Padaria Pão Quente Ltda")
      .comCnpj(CNPJ_VALIDO)
      .comRegime("simples_nacional")
      .comContratoSocialCaminho(null)
      .comAlteracoesContratuais([])
      .build();

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.value.formaEnvio.valor).toBe("whatsapp");
      expect(resultado.value.contatos).toEqual([]);
      expect(resultado.value.documentoObrigatorio).toBeNull();
      expect(resultado.value.dasStatus).toBeNull();
      expect(resultado.value.dataEnvioDas).toBeNull();
      expect(resultado.value.temParcelamento).toBe(false);
      expect(resultado.value.parcelamentoStatus).toBeNull();
      expect(resultado.value.observacoesGerais).toBe("");
      expect(resultado.value.atividadeMesAtual).toBeNull();
    }
  });

  it("constrói com todos os campos operacionais preenchidos", () => {
    const resultado = Cliente.builder()
      .comId("11111111-1111-1111-1111-111111111111")
      .comEmpresa("Padaria Pão Quente Ltda")
      .comCnpj(CNPJ_VALIDO)
      .comRegime("simples_nacional")
      .comContratoSocialCaminho(null)
      .comAlteracoesContratuais([])
      .comFormaEnvio("email")
      .comContatos([{ nome: "Maria", telefone: "11999990000", padrao: true }])
      .comDocumentoObrigatorio("positivo")
      .comDasStatus("pronto")
      .comDataEnvioDas(new Date("2026-09-10"))
      .comTemParcelamento(true)
      .comParcelamentoStatus("enviado")
      .comObservacoesGerais("Cliente pontual.")
      .comAtividadeMesAtual({ anoMes: "2026-09", industria: false, comercio: true, servico: false })
      .build();

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.value.formaEnvio.valor).toBe("email");
      expect(resultado.value.contatos).toHaveLength(1);
      expect(resultado.value.documentoObrigatorio?.valor).toBe("positivo");
      expect(resultado.value.dasStatus?.valor).toBe("pronto");
      expect(resultado.value.temParcelamento).toBe(true);
      expect(resultado.value.parcelamentoStatus?.valor).toBe("enviado");
      expect(resultado.value.observacoesGerais).toBe("Cliente pontual.");
      expect(resultado.value.atividadeMesAtual?.comercio).toBe(true);
    }
  });

  it("rejeita 2 contatos marcados como padrão ao mesmo tempo", () => {
    const resultado = Cliente.builder()
      .comId("11111111-1111-1111-1111-111111111111")
      .comEmpresa("Padaria Pão Quente Ltda")
      .comCnpj(CNPJ_VALIDO)
      .comRegime("simples_nacional")
      .comContratoSocialCaminho(null)
      .comAlteracoesContratuais([])
      .comContatos([
        { nome: "Maria", telefone: "11999990000", padrao: true },
        { nome: "João", telefone: "11988880000", padrao: true },
      ])
      .build();

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error.fields?.contatos).toBeDefined();
  });

  it("rejeita contatos sem nenhum marcado como padrão, quando há ao menos um contato", () => {
    const resultado = Cliente.builder()
      .comId("11111111-1111-1111-1111-111111111111")
      .comEmpresa("Padaria Pão Quente Ltda")
      .comCnpj(CNPJ_VALIDO)
      .comRegime("simples_nacional")
      .comContratoSocialCaminho(null)
      .comAlteracoesContratuais([])
      .comContatos([{ nome: "Maria", telefone: "11999990000", padrao: false }])
      .build();

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error.fields?.contatos).toBeDefined();
  });

  it("restaurar reconstitui os campos operacionais persistidos", () => {
    const resultado = Cliente.builder()
      .restaurar({
        id: "11111111-1111-1111-1111-111111111111",
        empresa: "Padaria Pão Quente Ltda",
        cnpj: CNPJ_VALIDO,
        regime: "simples_nacional",
        contratoSocialCaminho: null,
        alteracoesContratuais: [],
        formaEnvio: "email",
        contatos: [{ nome: "Maria", telefone: "11999990000", padrao: true }],
        documentoObrigatorio: "positivo",
        dasStatus: "pronto",
        dataEnvioDas: "2026-09-10",
        temParcelamento: true,
        parcelamentoStatus: "enviado",
        observacoesGerais: "Cliente pontual.",
        atividadeMesAtual: { anoMes: "2026-09", industria: false, comercio: true, servico: false },
      })
      .build();

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.value.formaEnvio.valor).toBe("email");
      expect(resultado.value.dataEnvioDas).toEqual(new Date("2026-09-10"));
      expect(resultado.value.atividadeMesAtual?.comercio).toBe(true);
    }
  });

  describe("e-mail", () => {
    const comBase = () =>
      Cliente.builder()
        .comId("11111111-1111-1111-1111-111111111111")
        .comEmpresa("Padaria Pão Quente Ltda")
        .comCnpj(CNPJ_VALIDO)
        .comRegime("simples_nacional")
        .comContratoSocialCaminho(null)
        .comAlteracoesContratuais([]);

    it("sem e-mail é null", () => {
      const resultado = comBase().build();
      expect(resultado.ok && resultado.value.email).toBeNull();
    });

    it("aceita e-mail com a letra s e rejeita espaço no meio", () => {
      const comS = comBase().comEmail("contato@silva.com.br").build();
      expect(comS.ok && comS.value.email).toBe("contato@silva.com.br");
      expect(comBase().comEmail("con tato@silva.com.br").build().ok).toBe(false);
    });

    it("guarda o e-mail sem espaços nas pontas", () => {
      const resultado = comBase().comEmail("  financeiro@padaria.com.br ").build();
      expect(resultado.ok && resultado.value.email).toBe("financeiro@padaria.com.br");
    });

    it("vazio ou só espaços vale como sem e-mail", () => {
      const resultado = comBase().comEmail("   ").build();
      expect(resultado.ok && resultado.value.email).toBeNull();
    });

    it("e-mail inválido é rejeitado apontando o campo", () => {
      const resultado = comBase().comEmail("sem-arroba").build();
      expect(resultado.ok).toBe(false);
      if (!resultado.ok) expect(resultado.error.fields?.email).toBeDefined();
    });

    it("e-mail acima de 254 caracteres é rejeitado (limite da coluna)", () => {
      const longo = `${"a".repeat(250)}@b.co`;
      expect(comBase().comEmail(longo).build().ok).toBe(false);
    });

    it("restaurar traz o e-mail do cadastro", () => {
      const resultado = Cliente.builder()
        .restaurar({
          id: "11111111-1111-1111-1111-111111111111",
          empresa: "Padaria Pão Quente Ltda",
          cnpj: CNPJ_VALIDO,
          regime: "simples_nacional",
          contratoSocialCaminho: null,
          email: "financeiro@padaria.com.br",
          alteracoesContratuais: [],
        })
        .build();
      expect(resultado.ok && resultado.value.email).toBe("financeiro@padaria.com.br");
    });
  });
});
