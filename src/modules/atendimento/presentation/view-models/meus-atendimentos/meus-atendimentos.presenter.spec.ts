import { atendimentoParaView } from "./meus-atendimentos.presenter";

describe("atendimentoParaView", () => {
  it("mostra o nome do Contato e a empresa, e leva à conversa", () => {
    expect(
      atendimentoParaView({
        atendimentoId: "at-1",
        telefone: "5561988887777",
        criadoEm: "2026-10-08T12:00:00Z",
        contato: { contatoNome: "Maria", empresa: "Padaria Ltda", cnpj: "11444777000161" },
      }),
    ).toEqual({ id: "at-1", href: "/atendimento/at-1", titulo: "Maria", detalhe: "Padaria Ltda" });
  });

  it("número não identificado aparece pelo telefone", () => {
    expect(
      atendimentoParaView({
        atendimentoId: "at-2",
        telefone: "5561988887777",
        criadoEm: "2026-10-08T12:00:00Z",
        contato: { contatoNome: null, empresa: null, cnpj: null },
      }),
    ).toEqual({
      id: "at-2",
      href: "/atendimento/at-2",
      titulo: "(61) 98888-7777",
      detalhe: "Cliente não identificado",
    });
  });
});
