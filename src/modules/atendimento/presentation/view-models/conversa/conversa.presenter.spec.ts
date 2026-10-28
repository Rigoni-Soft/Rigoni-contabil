import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";

import {
  acrescentarAnteriores,
  aplicarLinksRenovados,
  conversaParaView,
  documentoDaOpcao,
  formatarCronometro,
  formatarTamanho,
  idsComLinkVencendo,
  manterHistorico,
  reaproveitarLinks,
} from "./conversa.presenter";

const CONVERSA: ConversaVista = {
  atendimentoId: "at-1",
  encerrado: false,
  podeAtender: true,
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
      entrega: "entregue",
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
      entrega: "entregue",
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
      entrega: "entregue",
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
    { tipo: "contrato", numero: null, descricao: "Contrato social" },
    {
      tipo: "alteracao",
      numero: 3,
      descricao: "Alteração nº 3 - 01/03/2026",
    },
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
        aviso: null,
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
        aviso: null,
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
        aviso: null,
        anexo: null,
      },
    ]);
  });

  it("Mensagem do Funcionário com envio não confirmado (pendente/falha) leva o aviso", () => {
    const [pendente, falha] = (["pendente", "falha"] as const).map(
      (entrega) =>
        conversaParaView({
          ...CONVERSA,
          mensagens: [{ ...CONVERSA.mensagens[2], entrega }],
        }).mensagens[0].aviso,
    );
    expect(pendente).toBe("Envio não confirmado");
    expect(falha).toBe("Envio não confirmado");
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

  it("serviços viram opções com o nome que o cliente vê, na ordem recebida", () => {
    const antiga = {
      tipo: "alteracao" as const,
      numero: 2,
      descricao: "Alteração nº 2 - 10/05/2026",
    };
    const documentos = [CONVERSA.documentos[0], CONVERSA.documentos[1], antiga];

    expect(conversaParaView({ ...CONVERSA, documentos }).servicos).toEqual([
      { valor: "contrato", rotulo: "Contrato social", grupo: "contrato" },
      { valor: "alteracao:3", rotulo: "Alteração nº 3 - 01/03/2026", grupo: "alteracao" },
      { valor: "alteracao:2", rotulo: "Alteração nº 2 - 10/05/2026", grupo: "alteracao" },
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
    expect(documentoDaOpcao("contrato")).toEqual({ tipo: "contrato", numero: null });
    expect(documentoDaOpcao("alteracao:3")).toEqual({
      tipo: "alteracao",
      numero: 3,
    });
    expect(documentoDaOpcao("das")).toEqual({ tipo: "das", numero: null });
    expect(documentoDaOpcao("cnd")).toEqual({ tipo: "cnd", numero: null });
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
describe("manterHistorico", () => {
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

  // Mensagens m001..m350 em ordem, uma por minuto (id ordenável como a data).
  const sequencia = (de: number, ate: number) =>
    Array.from({ length: ate - de + 1 }, (_, i): [string, string] => {
      const n = de + i;
      const minutos = String(n).padStart(4, "0");
      return [
        `m${minutos}`,
        `2026-10-14T${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}:00Z`,
      ];
    });

  it("janelas sem sobreposição (250 novas entre duas leituras): descarta o cache e não emenda o buraco", () => {
    const anterior = lida(sequencia(1, 100), false);
    const nova = lida(sequencia(251, 350), true);

    const r = manterHistorico(nova, anterior);

    expect(r).toBe(nova);
    expect(r.mensagens).toHaveLength(100);
    expect(r.temMaisAnteriores).toBe(true);
  });

  it("com sobreposição (ainda dentro da janela) o histórico aberto continua e sem duplicar", () => {
    const anterior = lida(sequencia(1, 100), false);
    const nova = lida(sequencia(2, 101), true);

    const r = manterHistorico(nova, anterior);

    expect(r.mensagens.map((m) => m.id)).toEqual(sequencia(1, 101).map(([id]) => id));
    expect(r.temMaisAnteriores).toBe(false);
  });

  it("depois da recarga, as páginas anteriores recompõem uma sequência contínua e alcançável", () => {
    // A janela nova vale sozinha; o cursor do "ver anteriores" parte da primeira dela.
    const recarregada = manterHistorico(
      lida(sequencia(251, 350), true),
      lida(sequencia(1, 100), false),
    );
    const cursor = recarregada.mensagens[0];
    expect(cursor.id).toBe("m0251");
    expect(recarregada.temMaisAnteriores).toBe(true);
  });
});

describe("renovação de links de anexos antigos", () => {
  const AGORA_MS = Date.parse("2026-10-14T12:00:00Z");
  const margem = 5 * 60_000;
  const comLink = (id: string, expiraEm: string | null) => ({
    ...CONVERSA.mensagens[0],
    id,
    anexo: expiraEm
      ? {
          tipo: "documento" as const,
          nome: "balanco.pdf",
          tamanho: "1 KB",
          url: `https://l/${id}`,
          urlVisualizacao: `https://l/${id}-ver`,
          miniaturaUrl: null,
          expiraEm,
        }
      : null,
  });
  const conversa = (mensagens: ReturnType<typeof comLink>[]) =>
    ({ ...CONVERSA, mensagens }) as unknown as ConversaVista;

  it("pega só os anexos que vencem na margem (relógio avançado), fora da janela recente", () => {
    const c = conversa([
      comLink("velho", "2026-10-14T12:03:00Z"),
      comLink("longe", "2026-10-14T12:50:00Z"),
      comLink("sem-anexo", null),
      comLink("vencido", "2026-10-14T11:00:00Z"),
    ]);

    expect(idsComLinkVencendo(c, AGORA_MS, 20, margem)).toEqual(["velho", "vencido"]);
    // Uma hora depois todos estão vencendo.
    expect(idsComLinkVencendo(c, AGORA_MS + 60 * 60_000, 20, margem)).toEqual([
      "velho",
      "longe",
      "vencido",
    ]);
  });

  it("limita o lote e não reassina o histórico inteiro", () => {
    const c = conversa(
      Array.from({ length: 30 }, (_, i) => comLink(`m${i}`, "2026-10-14T11:00:00Z")),
    );
    expect(idsComLinkVencendo(c, AGORA_MS, 20, margem)).toHaveLength(20);
  });

  it("objetos ausentes em espera não ocupam o lote: os válidos seguintes são pedidos", () => {
    const c = conversa(
      Array.from({ length: 25 }, (_, i) => comLink(`m${i}`, "2026-10-14T11:00:00Z")),
    );
    const emEspera = new Set(Array.from({ length: 20 }, (_, i) => `m${i}`));

    const ids = idsComLinkVencendo(c, AGORA_MS, 20, margem, (id) => !emEspera.has(id));

    expect(ids).toEqual(["m20", "m21", "m22", "m23", "m24"]);
    // Sem ninguém em espera, o teto do lote continua valendo.
    expect(idsComLinkVencendo(c, AGORA_MS, 20, margem, () => true)).toHaveLength(20);
  });

  it("aplica o link novo só nos anexos renovados; objeto ausente (sem anexo) mantém o antigo", () => {
    const c = conversa([
      comLink("a", "2026-10-14T12:01:00Z"),
      comLink("b", "2026-10-14T12:01:00Z"),
    ]);
    const renovadas = [
      {
        ...comLink("a", "2026-10-14T13:00:00Z"),
        anexo: { ...comLink("a", "2026-10-14T13:00:00Z").anexo!, url: "https://l/a-novo" },
      },
      { ...comLink("b", null) },
    ] as unknown as Parameters<typeof aplicarLinksRenovados>[1];

    const r = aplicarLinksRenovados(c, renovadas);

    expect(r.mensagens[0].anexo).toMatchObject({
      url: "https://l/a-novo",
      expiraEm: "2026-10-14T13:00:00Z",
    });
    expect(r.mensagens[1].anexo).toMatchObject({
      url: "https://l/b",
      expiraEm: "2026-10-14T12:01:00Z",
    });
  });
});

describe("página anterior atrasada", () => {
  const msg = (id: string, criadoEm: string) => ({ ...CONVERSA.mensagens[0], id, criadoEm });
  const tela = (ids: string[], temMais = true): ConversaVista => ({
    ...CONVERSA,
    mensagens: ids.map((id, i) => msg(id, `2026-10-14T12:${String(i).padStart(2, "0")}:00Z`)),
    temMaisAnteriores: temMais,
  });
  const pagina = (ids: string[], temMais: boolean) => ({
    mensagens: ids.map((id) => msg(id, "2026-10-14T09:00:00Z")),
    temMaisAnteriores: temMais,
  });

  it("junta a página antes da primeira Mensagem quando o cursor ainda é o começo da tela", () => {
    const r = acrescentarAnteriores(tela(["m3", "m4"]), "m3", pagina(["m1", "m2"], false));
    expect(r.mensagens.map((m) => m.id)).toEqual(["m1", "m2", "m3", "m4"]);
    expect(r.temMaisAnteriores).toBe(false);
  });

  it("não repete Mensagem que o polling já trouxe", () => {
    const r = acrescentarAnteriores(tela(["m2", "m3"]), "m2", pagina(["m1", "m2"], true));
    expect(r.mensagens.map((m) => m.id)).toEqual(["m1", "m2", "m3"]);
  });

  it("descarta a página se o polling trocou a janela: sem junção descontínua nem falso fim", () => {
    // Pedido feito com a tela em m101..; o polling a substituiu por m351.. e só então a página chega.
    const atual = tela(["m351", "m352"], true);
    const r = acrescentarAnteriores(atual, "m101", pagina(["m1", "m100"], false));
    expect(r).toBe(atual);
    expect(r.temMaisAnteriores).toBe(true);
    // Um novo pedido, agora a partir do cursor atual, entra normalmente.
    const refeita = acrescentarAnteriores(atual, "m351", pagina(["m350"], true));
    expect(refeita.mensagens.map((m) => m.id)).toEqual(["m350", "m351", "m352"]);
  });
});

describe("formatarCronometro", () => {
  it("mostra minutos e segundos com dois dígitos", () => {
    expect(formatarCronometro(0)).toBe("00:00");
    expect(formatarCronometro(65)).toBe("01:05");
    expect(formatarCronometro(300)).toBe("05:00");
  });
});
