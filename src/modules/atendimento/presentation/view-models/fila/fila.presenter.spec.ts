import type { ItemDaFilaVisto } from "@/modules/atendimento/application/ports/in/listar-fila.provider";

import { avisoDaFila, itemDaFilaParaView, tituloDaFila } from "./fila.presenter";

const ITEM: ItemDaFilaVisto = {
  atendimentoId: "at-1",
  telefone: "5561988887777",
  contato: { contatoNome: "Maria", empresa: "Padaria Ltda", cnpj: "11444777000161" },
  resumo: "Quer o contrato social",
  filaDesde: new Date("2026-10-09T12:00:00Z"),
  espera: "00:05",
  filaDoFuncionarioId: null,
};

describe("itemDaFilaParaView", () => {
  it("formata Contato, Empresa, CNPJ e telefone para exibição", () => {
    expect(itemDaFilaParaView(ITEM)).toMatchObject({
      id: "at-1",
      contato: "Maria",
      empresa: "Padaria Ltda",
      cnpj: "11.444.777/0001-61",
      telefone: "(61) 98888-7777",
      resumo: "Quer o contrato social",
      daFilaDeUsuario: false,
    });
  });

  it("contato não identificado cai em rótulos legíveis e sem CNPJ", () => {
    const view = itemDaFilaParaView({
      ...ITEM,
      contato: { contatoNome: null, empresa: null, cnpj: null },
      resumo: null,
    });

    expect(view).toMatchObject({
      contato: "Contato não identificado",
      empresa: "Cliente não identificado",
      cnpj: null,
      resumo: null,
    });
  });

  it("indica quando é a fila de um usuário", () => {
    expect(itemDaFilaParaView({ ...ITEM, filaDoFuncionarioId: "u-1" }).daFilaDeUsuario).toBe(true);
  });
});

describe("tituloDaFila", () => {
  it("nomeia o Funcionário e o Setor", () => {
    expect(tituloDaFila("Ana", "simples_nacional")).toBe(
      "Fila de atendimento do Ana, setor Simples Nacional",
    );
  });
});

describe("avisoDaFila", () => {
  it("sem ninguém na Fila não há aviso", () => {
    expect(avisoDaFila([])).toBeNull();
  });

  it("resume a Fila e aponta para a tela dela", () => {
    expect(avisoDaFila([ITEM, { ...ITEM, atendimentoId: "at-2" }])).toMatchObject({
      href: "/fila",
      detalhe: "2 clientes aguardando",
      previa: "Próximo: Maria",
      aguardando: true,
      sinal: "at-1,at-2",
    });
  });
});
