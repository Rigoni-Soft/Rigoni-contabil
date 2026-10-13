import type { AtendimentoVisto } from "@/modules/atendimento/application/ports/in/listar-meus-atendimentos.provider";

import { atendimentoParaView } from "./meus-atendimentos.presenter";

const BASE: AtendimentoVisto = {
  atendimentoId: "at-1",
  telefone: "5561988887777",
  criadoEm: "2026-10-08T12:00:00Z",
  contato: { contatoNome: "Maria", empresa: "Padaria Ltda", cnpj: "11444777000161" },
  ultimaMensagem: null,
};

describe("atendimentoParaView", () => {
  it("mostra o nome do Contato e a empresa, e leva à conversa", () => {
    expect(atendimentoParaView(BASE)).toEqual({
      id: "at-1",
      href: "/atendimento/at-1",
      titulo: "Maria",
      detalhe: "Padaria Ltda",
      previa: null,
      aguardando: false,
      sinal: "",
    });
  });

  it("número não identificado aparece pelo telefone", () => {
    const view = atendimentoParaView({
      ...BASE,
      contato: { contatoNome: null, empresa: null, cnpj: null },
    });

    expect(view).toMatchObject({ titulo: "(61) 98888-7777", detalhe: "Cliente não identificado" });
  });

  it("mensagem do cliente: prévia sem prefixo e o cliente está aguardando", () => {
    const view = atendimentoParaView({
      ...BASE,
      ultimaMensagem: { autor: "contato", texto: "  preciso\ndo   contrato ", criadoEm: "t1" },
    });

    expect(view).toMatchObject({ previa: "preciso do contrato", aguardando: true, sinal: "t1" });
  });

  it("mensagem do Funcionário ou da URA: prefixada e o cliente não está aguardando", () => {
    const ultima = (autor: "funcionario" | "ura") => ({ autor, texto: "oi", criadoEm: "t2" });

    expect(atendimentoParaView({ ...BASE, ultimaMensagem: ultima("funcionario") })).toMatchObject({
      previa: "Você: oi",
      aguardando: false,
    });
    expect(atendimentoParaView({ ...BASE, ultimaMensagem: ultima("ura") })).toMatchObject({
      previa: "URA: oi",
      aguardando: false,
    });
  });

  it("prévia longa é cortada com reticências", () => {
    const view = atendimentoParaView({
      ...BASE,
      ultimaMensagem: { autor: "contato", texto: "x".repeat(100), criadoEm: "t3" },
    });

    expect(view.previa).toHaveLength(60);
    expect(view.previa?.endsWith("…")).toBe(true);
  });

  it("prévia longa de emojis corta por caractere, sem partir o emoji", () => {
    const view = atendimentoParaView({
      ...BASE,
      ultimaMensagem: { autor: "contato", texto: "😀".repeat(100), criadoEm: "t4" },
    });

    expect(view.previa).toBe(`${"😀".repeat(59)}…`);
  });
});
