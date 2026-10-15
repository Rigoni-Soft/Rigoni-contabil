import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";

import {
  conversaParaView,
  documentoDaOpcao,
  formatarCronometro,
  formatarTamanho,
  manterHistorico,
  reaproveitarLinks,
} from "./conversa.presenter";

const CONVERSA: ConversaVista = {
  atendimentoId: "at-1",
  encerrado: false,
  telefone: "5561988887777",
  contato: { contatoNome: "Maria", empresa: "Padaria Ltda", cnpj: "11444777000161" },
  clienteVinculado: true,
  mensagens: [
    {
      id: "1",
      autor: "contato",
      texto: "oi",
      criadoEm: "2026-10-08T15:30:00Z",
      atendente: null,
      reacao: null,
      reagivel: false,
      anexo: null,
    },
    {
      id: "2",
      autor: "ura",
      texto: "olá",
      criadoEm: "2026-10-08T15:31:00Z",
      atendente: null,
      reacao: null,
      reagivel: false,
      anexo: null,
    },
    {
      id: "3",
      autor: "funcionario",
      texto: "Enviou ao cliente: Contrato social",
      criadoEm: "2026-10-08T15:32:00Z",
      atendente: { nome: "Ana", setor: "simples_nacional" },
      reacao: null,
      reagivel: false,
      anexo: null,
    },
  ],
  ultimaTransferencia: null,
  ura: null,
  temMaisAnteriores: false,
  avisoInatividade: false,
  setoresDestino: ["recepcao", "tributario"],
  documentos: [
    { tipo: "contrato", data: null, descricao: "Contrato social" },
    { tipo: "alteracao", data: "2026-03-01", descricao: "Alteração de 01/03/2026" },
  ],
};

describe("conversaParaView", () => {
  it("repassa o aviso de inatividade ao Funcionário", () => {
    expect(conversaParaView(CONVERSA).avisoInatividade).toBe(false);
    expect(conversaParaView({ ...CONVERSA, avisoInatividade: true }).avisoInatividade).toBe(true);
  });

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
        reacao: null,
        reagivel: false,
        anexo: null,
      },
      {
        id: "2",
        lado: "ura",
        autor: "URA",
        detalhe: null,
        texto: "olá",
        hora: "08/10 12:31",
        reacao: null,
        reagivel: false,
        anexo: null,
      },
      {
        id: "3",
        lado: "atendente",
        autor: "Ana · Simples Nacional",
        detalhe: null,
        texto: "Enviou ao cliente: Contrato social",
        hora: "08/10 12:32",
        reacao: null,
        reagivel: false,
        anexo: null,
      },
    ]);
  });

  it("mostra a origem e o resumo da última Transferência; da Fila não tem nome de quem transferiu", () => {
    const transferida = (origemNome: string | null) =>
      conversaParaView({
        ...CONVERSA,
        ultimaTransferencia: { setorOrigem: "recepcao", origemNome, resumo: "Dúvida no DAS" },
      }).contexto;
    expect(conversaParaView(CONVERSA).contexto).toBeNull();
    expect(transferida("Ana")).toEqual({
      origem: "Transferido por Ana · Recepção",
      resumo: "Dúvida no DAS",
    });
    expect(transferida(null)?.origem).toBe("Transferido do setor Recepção");
  });

  it("sem Transferência, o contexto é o resumo da URA; com Transferência, vale a Transferência", () => {
    const daUra = { ...CONVERSA, ura: { resumo: "Quer abrir uma empresa", cnpjInformado: null } };
    expect(conversaParaView(daUra).contexto).toEqual({
      origem: "Aberto pela URA",
      resumo: "Quer abrir uma empresa",
    });
    const transferida = {
      ...daUra,
      ultimaTransferencia: { setorOrigem: "recepcao" as const, origemNome: "Ana", resumo: "DAS" },
    };
    expect(conversaParaView(transferida).contexto?.resumo).toBe("DAS");
  });

  it("sem Cliente, mostra o CNPJ que o número informou como provável cliente novo", () => {
    const semCliente = {
      ...CONVERSA,
      clienteVinculado: false,
      contato: { contatoNome: null, empresa: null, cnpj: null },
      ura: { resumo: "Quer abrir uma empresa", cnpjInformado: "11444777000161" },
    };
    expect(conversaParaView(semCliente).subtitulo).toBe(
      "Provável cliente novo · CNPJ informado 11.444.777/0001-61 · (61) 98888-7777",
    );
    expect(conversaParaView({ ...semCliente, ura: null }).subtitulo).toBe(
      "Cliente não identificado",
    );
    // O CNPJ informado aparece mesmo sem resumo da URA; o bloco de contexto é que some.
    const semResumo = { ...semCliente, ura: { resumo: null, cnpjInformado: "11444777000161" } };
    expect(conversaParaView(semResumo).subtitulo).toContain("Provável cliente novo");
    expect(conversaParaView(semResumo).contexto).toBeNull();
  });

  it("serviços viram opções com o nome que o cliente vê: contrato primeiro, alterações da mais recente para a mais antiga", () => {
    const antiga = {
      tipo: "alteracao" as const,
      data: "2025-01-10",
      descricao: "Alteração de 10/01/2025",
    };
    const documentos = [antiga, CONVERSA.documentos[1], CONVERSA.documentos[0]];

    expect(conversaParaView({ ...CONVERSA, documentos }).servicos).toEqual([
      { valor: "contrato", rotulo: "Contrato social", grupo: "contrato" },
      { valor: "alteracao:2026-03-01", rotulo: "Alteração de 01/03/2026", grupo: "alteracao" },
      { valor: "alteracao:2025-01-10", rotulo: "Alteração de 10/01/2025", grupo: "alteracao" },
    ]);
  });

  it("destinos de transferência viram opções com o nome do Setor", () => {
    expect(conversaParaView(CONVERSA).setoresDestino).toEqual([
      { valor: "recepcao", rotulo: "Recepção" },
      { valor: "tributario", rotulo: "Tributário" },
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

describe("anexo na conversa", () => {
  const AGORA = Date.parse("2026-10-14T12:00:00Z");
  const comAnexo = (url: string, expiraEm: string): ConversaVista => ({
    ...CONVERSA,
    mensagens: [
      {
        ...CONVERSA.mensagens[2],
        texto: "Segue",
        anexo: {
          tipo: "documento",
          nome: "balanco.pdf",
          tamanho: 1536,
          url,
          urlVisualizacao: `${url}-ver`,
          miniaturaUrl: `${url}-mini`,
          expiraEm,
        },
      },
    ],
  });

  it("formata o tamanho em B, KB e MB", () => {
    expect(formatarTamanho(512)).toBe("512 B");
    expect(formatarTamanho(1536)).toBe("1,5 KB");
    expect(formatarTamanho(10 * 1024 * 1024)).toBe("10 MB");
  });

  it("mostra o anexo com nome, tamanho e link no balão", () => {
    const view = conversaParaView(comAnexo("https://l/1", "2026-10-14T13:00:00Z"));
    expect(view.mensagens[0].anexo).toEqual({
      tipo: "documento",
      nome: "balanco.pdf",
      tamanho: "1,5 KB",
      url: "https://l/1",
      urlVisualizacao: "https://l/1-ver",
      miniaturaUrl: "https://l/1-mini",
    });
  });

  it("reaproveita o link da leitura anterior enquanto falta tempo para expirar", () => {
    const anterior = comAnexo("https://l/velho", "2026-10-14T12:30:00Z");
    const nova = comAnexo("https://l/novo", "2026-10-14T13:00:00Z");

    const r = reaproveitarLinks(nova, anterior, AGORA);

    expect(r.mensagens[0].anexo).toMatchObject({
      url: "https://l/velho",
      miniaturaUrl: "https://l/velho-mini",
      expiraEm: "2026-10-14T12:30:00Z",
    });
  });

  it("troca pelo link novo quando o antigo está perto de expirar", () => {
    const anterior = comAnexo("https://l/velho", "2026-10-14T12:04:00Z");
    const nova = comAnexo("https://l/novo", "2026-10-14T13:00:00Z");

    expect(reaproveitarLinks(nova, anterior, AGORA).mensagens[0].anexo?.url).toBe("https://l/novo");
  });

  it("sem leitura anterior ou com anexo novo, fica o link recebido", () => {
    const nova = comAnexo("https://l/novo", "2026-10-14T13:00:00Z");
    expect(reaproveitarLinks(nova, undefined, AGORA)).toBe(nova);
    expect(reaproveitarLinks(nova, CONVERSA, AGORA).mensagens[0].anexo?.url).toBe("https://l/novo");
  });
});
describe("manterHistorico (R85-05)", () => {
  const msg = (id: string, criadoEm: string) => ({
    ...CONVERSA.mensagens[0],
    id,
    criadoEm,
  });
  const lida = (ids: [string, string][], temMais: boolean): ConversaVista => ({
    ...CONVERSA,
    mensagens: ids.map(([id, em]) => msg(id, em)),
    temMaisAnteriores: temMais,
  });

  it("mantém o histórico já aberto antes da janela e o 'tem mais' dele", () => {
    const anterior = lida(
      [
        ["a", "2026-10-14T10:00:00Z"],
        ["b", "2026-10-14T11:00:00Z"],
        ["c", "2026-10-14T12:00:00Z"],
      ],
      false,
    );
    const nova = lida(
      [
        ["c", "2026-10-14T12:00:00Z"],
        ["d", "2026-10-14T12:05:00Z"],
      ],
      true,
    );

    const r = manterHistorico(nova, anterior);

    expect(r.mensagens.map((m) => m.id)).toEqual(["a", "b", "c", "d"]);
    expect(r.temMaisAnteriores).toBe(false);
  });

  it("no empate de data o id desempata", () => {
    const anterior = lida(
      [
        ["a", "2026-10-14T12:00:00Z"],
        ["b", "2026-10-14T12:00:00Z"],
      ],
      false,
    );
    const nova = lida([["b", "2026-10-14T12:00:00Z"]], true);

    expect(manterHistorico(nova, anterior).mensagens.map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("sem leitura anterior ou sem histórico aberto, fica a leitura recebida", () => {
    const nova = lida([["c", "2026-10-14T12:00:00Z"]], true);
    expect(manterHistorico(nova, undefined)).toBe(nova);
    expect(manterHistorico(nova, lida([["c", "2026-10-14T12:00:00Z"]], true))).toBe(nova);
  });
});

describe("formatarCronometro", () => {
  it("mostra minutos e segundos com dois dígitos", () => {
    expect(formatarCronometro(0)).toBe("00:00");
    expect(formatarCronometro(65)).toBe("01:05");
    expect(formatarCronometro(300)).toBe("05:00");
  });
});
