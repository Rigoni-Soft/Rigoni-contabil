import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";

import { conversaParaView, documentoDaOpcao } from "./conversa.presenter";

const CONVERSA: ConversaVista = {
  atendimentoId: "at-1",
  encerrado: false,
  telefone: "5561988887777",
  contato: { contatoNome: "Maria", empresa: "Padaria Ltda", cnpj: "11444777000161" },
  clienteVinculado: true,
  mensagens: [
    { id: "1", autor: "contato", texto: "oi", criadoEm: "2026-10-08T15:30:00Z", atendente: null },
    { id: "2", autor: "ura", texto: "olá", criadoEm: "2026-10-08T15:31:00Z", atendente: null },
    {
      id: "3",
      autor: "funcionario",
      texto: "Enviou ao cliente: Contrato social",
      criadoEm: "2026-10-08T15:32:00Z",
      atendente: { nome: "Ana", setor: "simples_nacional" },
    },
  ],
  documentos: [
    { tipo: "contrato", data: null, descricao: "Contrato social" },
    { tipo: "alteracao", data: "2026-03-01", descricao: "Alteração de 01/03/2026" },
  ],
};

describe("conversaParaView", () => {
  it("balão do cliente mostra o nome do Contato e o do atendente mostra nome e Setor", () => {
    const view = conversaParaView(CONVERSA);
    expect(view.titulo).toBe("Maria");
    expect(view.subtitulo).toBe("Padaria Ltda · 11.444.777/0001-61 · (61) 98888-7777");
    expect(view.mensagens).toEqual([
      {
        id: "1",
        lado: "contato",
        autor: "Maria",
        detalhe: "CNPJ 11.444.777/0001-61",
        texto: "oi",
        hora: "08/10 12:30",
      },
      { id: "2", lado: "ura", autor: "URA", detalhe: null, texto: "olá", hora: "08/10 12:31" },
      {
        id: "3",
        lado: "atendente",
        autor: "Ana · Simples Nacional",
        detalhe: null,
        texto: "Enviou ao cliente: Contrato social",
        hora: "08/10 12:32",
      },
    ]);
  });

  it("serviços viram opções com o nome que o cliente vê", () => {
    expect(conversaParaView(CONVERSA).servicos).toEqual([
      { valor: "contrato", rotulo: "Contrato social", grupo: "contrato" },
      { valor: "alteracao:2026-03-01", rotulo: "Alteração de 01/03/2026", grupo: "alteracao" },
    ]);
  });

  it("número não identificado usa o telefone no lugar do nome e avisa que falta Cliente", () => {
    const view = conversaParaView({
      ...CONVERSA,
      contato: { contatoNome: null, empresa: null, cnpj: null },
      clienteVinculado: false,
      documentos: [],
    });
    expect(view.titulo).toBe("(61) 98888-7777");
    expect(view.subtitulo).toBe("Cliente não identificado");
    expect(view.semCliente).toBe(true);
    expect(view.mensagens[0].autor).toBe("(61) 98888-7777");
    expect(view.mensagens[0].detalhe).toBe("CNPJ não definido");
  });
});

describe("documentoDaOpcao", () => {
  it("desfaz o valor da opção no documento", () => {
    expect(documentoDaOpcao("contrato")).toEqual({ tipo: "contrato", data: null });
    expect(documentoDaOpcao("alteracao:2026-03-01")).toEqual({
      tipo: "alteracao",
      data: "2026-03-01",
    });
  });
});
