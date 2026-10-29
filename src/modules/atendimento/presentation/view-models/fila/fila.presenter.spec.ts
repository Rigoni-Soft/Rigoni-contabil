import type { ItemDaFilaVisto } from "@/modules/atendimento/application/ports/in/listar-fila.provider";

import { avisoDaFila, itemDaFilaParaView, tituloDaFila } from "./fila.presenter";

const ITEM: ItemDaFilaVisto = {
  atendimentoId: "at-1",
  telefone: "5561988887777",
  contato: { contatoNome: "Maria", empresa: "Padaria Ltda", cnpj: "11444777000161" },
  resumo: "Quer o contrato social",
  origem: null,
  filaDesde: new Date("2026-10-09T12:00:00Z"),
  espera: "00:05",
  filaDoFuncionarioId: null,
  esperaComum: true,
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
      dirigido: false,
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

  it("diz de onde veio o Atendimento transferido, com e sem o Funcionário de origem", () => {
    const origem = (nome: string | null) =>
      itemDaFilaParaView({ ...ITEM, origem: { setor: "financeiro", nome } }).origem;

    expect(origem("Ana")).toBe("Transferido de Financeiro por Ana");
    expect(origem(null)).toBe("Transferido de Financeiro");
    expect(itemDaFilaParaView(ITEM).origem).toBeNull();
  });

  it("indica quando é a fila de um usuário", () => {
    expect(itemDaFilaParaView({ ...ITEM, filaDoFuncionarioId: "u-1" }).dirigido).toBe(true);
  });
});

describe("assumivel", () => {
  const assumivel = (parcial: Partial<ItemDaFilaVisto>, usuarioId = "u-1") =>
    itemDaFilaParaView({ ...ITEM, ...parcial }, undefined, usuarioId).assumivel;

  it("espera comum (Recepção) é de todos; sem destinatário fora dela é só supervisão", () => {
    expect(assumivel({ filaDoFuncionarioId: null, esperaComum: true })).toBe(true);
    expect(assumivel({ filaDoFuncionarioId: null, esperaComum: false })).toBe(false);
  });

  it("dirigida, só o destinatário assume", () => {
    expect(assumivel({ filaDoFuncionarioId: "u-1" })).toBe(true);
    expect(assumivel({ filaDoFuncionarioId: "u-2" })).toBe(false);
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
      previa: "Mais antigo: Maria",
      aguardando: true,
      sinal: "at-1,at-2",
    });
  });
});
