import type { CadastroFiscalCliente } from "@/modules/atendimento/application/ports/out/cliente-cnpj.provider";
import type { ClienteParaParcelamento } from "@/modules/atendimento/application/ports/out/clientes-para-parcelamento.provider";
import type { GuiaFiscal } from "@/modules/atendimento/application/ports/out/guias-fiscais.provider";
import type { ParcelamentoPgfn } from "@/modules/atendimento/application/ports/out/guias-pgfn.provider";
import type {
  EnvioRegistrado,
  GuiaEntregue,
  ParcelamentoDoCliente,
} from "@/modules/atendimento/application/ports/out/parcelamentos-do-cliente.provider";
import { EnvioMensagemFalsoGateway } from "@/modules/atendimento/infra/gateways/envio-mensagem-falso.gateway";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok, type Result } from "@/shared/kernel/result";

import { EntregarComunicacaoPorCanais } from "./entregar-comunicacao-por-canais.use-case";
import { EnviarComunicacaoProativa } from "./enviar-comunicacao-proativa.use-case";
import { EnviarGuiasParcelamento } from "./enviar-guias-parcelamento.use-case";

// 22/10/2026 09:00 em São Paulo.
const agora = new Date("2026-10-22T12:00:00Z");
const telefone = "5511912345678";
const telefoneFinanceiro = "5511900001111";

const cliente: ClienteParaParcelamento = {
  clienteId: "c1",
  empresa: "3A Construções",
  formaEnvio: "whatsapp",
  contato: { nome: "Ângela", telefone },
  email: null,
  ultimaMensagemDoContatoEm: null,
};

const guia = (parcela: string, valorCentavos = 10_000): GuiaFiscal => ({
  nomeArquivo: `${parcela}.pdf`,
  pdfBase64: "JVBERi0=",
  parcela,
  valorCentavos,
});

const parcelamento = (
  id: string,
  extra: Partial<ParcelamentoDoCliente> = {},
): ParcelamentoDoCliente => ({
  id,
  codigo: `COD-${id}`,
  interno: false,
  valorParcelaCentavos: 10_000,
  parcelasRestantes: 5,
  parcelasEnviadas: [],
  ...extra,
});

function montar(
  parcelamentos: Result<ParcelamentoDoCliente[], AppError>,
  opcoes: {
    guias?: () => Promise<Result<GuiaFiscal[], AppError>>;
    registrar?: (id: string, parcela: string) => Promise<Result<EnvioRegistrado, AppError>>;
    // Guias já entregues a acordos do Cliente (inclusive quitados).
    entregues?: GuiaEntregue[];
    // Telefone do financeiro; null = não configurado.
    financeiro?: string | null;
    cnpj?: () => Promise<Result<CadastroFiscalCliente, AppError>>;
    // Parcelamentos PGFN em aberto com as guias confirmadas (#186).
    pgfn?: Result<ParcelamentoPgfn[], AppError>;
    lerFalha?: boolean;
    // Parcela cuja publicação falha.
    publicarFalha?: string;
  } = {},
) {
  const envio = new EnvioMensagemFalsoGateway();
  const emails: unknown[] = [];
  const registrados: [string, string][] = [];
  const identidades: string[] = [];
  const caminhos: string[] = [];
  const publicadas: unknown[] = [];
  const ignorados: (readonly string[])[] = [];
  const lidos: string[] = [];
  const buscarGuiasParcelamento = jest.fn(async (_: string, ignorar: readonly string[]) => {
    ignorados.push(ignorar);
    return (await opcoes.guias?.()) ?? ok([guia("202610")]);
  });
  const nucleo = new EnviarGuiasParcelamento(
    {
      listarEmAberto: async () => parcelamentos,
      contarComuns: async () => ok(0),
      guiasEntregues: async () => ok(opcoes.entregues ?? []),
      registrarEnvio: async (id, parcela, identidade, caminho) => {
        registrados.push([id, parcela]);
        identidades.push(identidade);
        caminhos.push(caminho);
        return opcoes.registrar?.(id, parcela) ?? ok("registrado");
      },
    },
    { buscarGuiasParcelamento },
    {
      publicar: async (_clienteId, _guia, destino) => {
        if (destino?.periodo === opcoes.publicarFalha) {
          return err(new ServicoExternoError("storage"));
        }
        publicadas.push(destino);
        return ok({
          url: `https://storage.test/${destino?.id}/${destino?.periodo}.pdf`,
          caminho: `c1/${destino?.id}/${destino?.periodo}-hash.pdf`,
        });
      },
      reencontrar: async (_clienteId, caminho) => ok(`https://storage.test/${caminho}`),
    },
    new EntregarComunicacaoPorCanais(new EnviarComunicacaoProativa(envio, 3, 0), {
      enviar: async (email) => {
        emails.push(email);
        return ok(undefined);
      },
    }),
    {
      envio,
      cnpjs: {
        cadastroFiscalDoCliente:
          opcoes.cnpj ?? (async () => ok({ cnpj: "12345678000190", regime: "simples_nacional" })),
      },
      telefone: opcoes.financeiro === undefined ? telefoneFinanceiro : opcoes.financeiro,
    },
    {
      listarEmAberto: async () => opcoes.pgfn ?? ok([]),
      ler: async (_clienteId, caminho) => {
        lidos.push(caminho);
        return opcoes.lerFalha ? err(new ServicoExternoError("storage")) : ok("JVBERi0=");
      },
    },
    0,
  );
  return {
    nucleo,
    envio,
    emails,
    registrados,
    identidades,
    publicadas,
    caminhos,
    ignorados,
    lidos,
    buscarGuiasParcelamento,
  };
}

const pgfn = (
  id: string,
  guias: string[],
  extra: Partial<ParcelamentoPgfn> = {},
): ParcelamentoPgfn => ({
  ...parcelamento(id),
  guias: guias.map((competencia) => ({
    competencia,
    caminho: `c1/guias-pgfn/${id}/${competencia}.pdf`,
  })),
  entregues: (extra.parcelasEnviadas ?? []).map((competencia) => ({
    competencia,
    caminho: `c1/guias-pgfn/${id}/${competencia}-entregue.pdf`,
  })),
  ...extra,
});

describe("EnviarGuiasParcelamento", () => {
  beforeEach(() => {
    jest.spyOn(console, "info").mockImplementation(() => undefined);
  });

  it("entrega a guia do parcelamento em aberto e registra o envio com a identidade da guia", async () => {
    const { nucleo, envio, registrados, identidades, caminhos, publicadas } = montar(
      ok([parcelamento("p1")]),
    );

    const andamento = await nucleo.execute({ cliente, agora });

    expect(andamento).toEqual({ enviado: true, ocorrencias: [] });
    expect(envio.templatesEnviados).toMatchObject([
      {
        nome: "envio_guia_parcelamento",
        telefone,
        variaveis: ["Ângela", "3A Construções", "10/2026"],
        documento: { url: "https://storage.test/p1/202610.pdf", nomeArquivo: "202610.pdf" },
      },
    ]);
    expect(publicadas).toEqual([{ id: "p1", periodo: "202610" }]);
    expect(registrados).toEqual([["p1", "202610"]]);
    expect(identidades).toEqual(["202610:10000"]);
    expect(caminhos).toEqual(["c1/p1/202610-hash.pdf"]);
  });

  it.each([
    ["sem parcelamento em aberto", [] as ParcelamentoDoCliente[]],
    ["o do mês já enviado", [parcelamento("p1", { parcelasEnviadas: ["202610"] })]],
  ])("%s: não chama o provedor fiscal nem envia nada", async (_, lista) => {
    const { nucleo, envio, buscarGuiasParcelamento } = montar(ok(lista));

    const andamento = await nucleo.execute({ cliente, agora });

    expect(andamento).toEqual({ enviado: false, ocorrencias: [] });
    expect(buscarGuiasParcelamento).not.toHaveBeenCalled();
    expect(envio.requisicoes).toHaveLength(0);
  });

  it("pede ao provedor só as parcelas que falta a algum parcelamento (as de todos ficam de fora)", async () => {
    const { nucleo, ignorados } = montar(
      ok([
        parcelamento("p1", { parcelasEnviadas: ["202609", "202610"] }),
        parcelamento("p2", { parcelasEnviadas: ["202609"] }),
      ]),
    );

    await nucleo.execute({ cliente, agora });

    expect(ignorados).toEqual([["202609"]]);
  });

  it("a falha do registro de uma guia não trava a outra do mesmo acordo", async () => {
    const { nucleo, envio, registrados } = montar(ok([parcelamento("p1")]), {
      guias: async () => ok([guia("202609"), guia("202610")]),
      registrar: async (_id, parcela) =>
        parcela === "202609" ? err(new ServicoExternoError("banco fora")) : ok("registrado"),
    });

    const andamento = await nucleo.execute({ cliente, agora });

    expect(envio.templatesEnviados).toHaveLength(2);
    expect(registrados).toEqual([
      ["p1", "202609"],
      ["p1", "202610"],
    ]);
    expect(andamento.enviado).toBe(true);
    expect(andamento.ocorrencias).toMatchObject([
      { tipo: "falha_envio", mensagem: expect.stringContaining("COD-p1") },
    ]);
  });

  it("provedor fiscal fora do ar depois das tentativas: falha_envio e nada registrado", async () => {
    const { nucleo, registrados, buscarGuiasParcelamento } = montar(ok([parcelamento("p1")]), {
      guias: async () => err(new ServicoExternoError("serpro fora")),
    });

    const andamento = await nucleo.execute({ cliente, agora });

    expect(buscarGuiasParcelamento).toHaveBeenCalledTimes(3);
    expect(andamento.enviado).toBe(false);
    expect(andamento.ocorrencias).toMatchObject([
      { tipo: "falha_envio", mensagem: expect.stringContaining("serpro fora") },
    ]);
    expect(registrados).toEqual([]);
  });

  it("parcelamento pendente sem guia: parcelamento_sem_guia lista os códigos", async () => {
    const { nucleo, envio } = montar(ok([parcelamento("p1"), parcelamento("p2")]), {
      guias: async () => ok([]),
    });

    const andamento = await nucleo.execute({ cliente, agora });

    expect(envio.requisicoes).toHaveLength(0);
    expect(andamento).toEqual({
      enviado: false,
      ocorrencias: [
        { tipo: "parcelamento_sem_guia", mensagem: expect.stringMatching(/COD-p1.*COD-p2/) },
      ],
    });
  });

  it("guia do parcelamento interno vai ao WhatsApp do financeiro, nunca ao Cliente", async () => {
    const { nucleo, envio, registrados } = montar(
      ok([parcelamento("interno", { interno: true, parcelasRestantes: 7 })]),
      { guias: async () => ok([guia("202610")]) },
    );

    const andamento = await nucleo.execute({ cliente, agora });

    expect(andamento).toEqual({ enviado: true, ocorrencias: [] });
    expect(envio.templatesEnviados).toMatchObject([
      {
        nome: "envio_guia_parcelamento_interno",
        telefone: telefoneFinanceiro,
        idioma: "pt_BR",
        variaveis: ["3A Construções", "12345678000190", "COD-interno", "10/2026", "6"],
        documento: { url: "https://storage.test/interno/202610.pdf", nomeArquivo: "202610.pdf" },
      },
    ]);
    expect(registrados).toEqual([["interno", "202610"]]);
  });

  it("parcelas restantes no template são as de depois do desconto, também com duas guias do mesmo interno", async () => {
    const { nucleo, envio } = montar(ok([parcelamento("p1", { interno: true })]), {
      guias: async () => ok([guia("202609"), guia("202610")]),
    });

    await nucleo.execute({ cliente, agora });

    expect(envio.templatesEnviados.map((t) => [t.variaveis[3], t.variaveis[4]])).toEqual([
      ["09/2026", "4"],
      ["10/2026", "3"],
    ]);
  });

  it("guia entregue mas não descontada pelo banco (registro falhou ou já existia) não entra na conta das restantes", async () => {
    let chamadas = 0;
    const { nucleo, envio } = montar(ok([parcelamento("p1", { interno: true })]), {
      guias: async () => ok([guia("202609"), guia("202610")]),
      registrar: async () => {
        chamadas += 1;
        return chamadas === 1 ? err(new ServicoExternoError("banco fora")) : ok("registrado");
      },
    });

    await nucleo.execute({ cliente, agora });

    expect(envio.templatesEnviados.map((t) => t.variaveis[4])).toEqual(["4", "4"]);
  });

  it("interno ignora a forma de envio e a janela de 24h do Cliente: sempre template, nunca e-mail", async () => {
    const { nucleo, envio, emails } = montar(ok([parcelamento("p1", { interno: true })]));
    const comJanelaAberta = {
      ...cliente,
      formaEnvio: "whatsapp_e_email" as const,
      email: "cliente@3a.com.br",
      ultimaMensagemDoContatoEm: new Date("2026-10-22T11:00:00Z"),
    };

    await nucleo.execute({ cliente: comJanelaAberta, agora });

    expect(emails).toEqual([]);
    expect(envio.enviadas).toEqual([]);
    expect(envio.documentosEnviados).toEqual([]);
    expect(envio.templatesEnviados).toMatchObject([
      { nome: "envio_guia_parcelamento_interno", telefone: telefoneFinanceiro },
    ]);
  });

  it("Cliente sem contato ainda recebe o interno no financeiro", async () => {
    const { nucleo, envio } = montar(ok([parcelamento("interno", { interno: true })]), {
      guias: async () => ok([guia("202610")]),
    });

    const andamento = await nucleo.execute({
      cliente: { ...cliente, contato: null, email: null },
      agora,
    });

    expect(andamento).toMatchObject({ enviado: true, ocorrencias: [] });
    expect(envio.templatesEnviados).toMatchObject([
      { nome: "envio_guia_parcelamento_interno", telefone: telefoneFinanceiro },
    ]);
  });

  it("sem telefone do financeiro: o interno não é enviado, segue pendente e abre financeiro_ausente", async () => {
    const { nucleo, envio, registrados, buscarGuiasParcelamento } = montar(
      ok([parcelamento("p1", { interno: true })]),
      { financeiro: null },
    );

    const andamento = await nucleo.execute({ cliente, agora });

    expect(andamento).toEqual({
      enviado: false,
      ocorrencias: [{ tipo: "financeiro_ausente", mensagem: expect.stringContaining("COD-p1") }],
    });
    expect(buscarGuiasParcelamento).not.toHaveBeenCalled();
    expect(envio.requisicoes).toHaveLength(0);
    expect(registrados).toEqual([]);
  });

  it("sem financeiro, a guia do interno não cai no comum (de valor menor)", async () => {
    const { nucleo, envio, registrados } = montar(
      ok([
        parcelamento("comum", { valorParcelaCentavos: 10_000 }),
        parcelamento("interno", { interno: true, valorParcelaCentavos: 30_000 }),
      ]),
      { financeiro: null, guias: async () => ok([guia("202610", 30_000)]) },
    );

    const andamento = await nucleo.execute({ cliente, agora });

    expect(envio.requisicoes).toHaveLength(0);
    expect(registrados).toEqual([]);
    expect(andamento.ocorrencias.map((o) => o.tipo).sort()).toEqual([
      "financeiro_ausente",
      "parcelamento_sem_guia",
    ]);
  });

  it.each([
    ["interno sem valor, comum com valor", true],
    ["comum sem valor, interno com valor", false],
  ])(
    "acordo sem valor cadastrado não some do conjunto: %s, a guia ambígua não é entregue nem registrada",
    async (_, internoSemValor) => {
      const { nucleo, envio, registrados } = montar(
        ok([
          parcelamento("a", { interno: internoSemValor, valorParcelaCentavos: null }),
          parcelamento("b", { interno: !internoSemValor, valorParcelaCentavos: 10_000 }),
        ]),
        { guias: async () => ok([guia("202610", 30_500)]) },
      );

      const andamento = await nucleo.execute({ cliente, agora });

      expect(envio.requisicoes).toHaveLength(0);
      expect(registrados).toEqual([]);
      expect(andamento.ocorrencias.map((o) => o.tipo)).toContain("parcelamento_sem_guia");
    },
  );

  it("uma mensagem por guia: a falha de entrega de uma vira falha_envio e não afeta a outra", async () => {
    const { nucleo, envio, registrados, caminhos } = montar(
      ok([parcelamento("a", { interno: true })]),
      { guias: async () => ok([guia("202609"), guia("202610")]) },
    );
    const enviarTemplate = envio.enviarTemplate.bind(envio);
    jest
      .spyOn(envio, "enviarTemplate")
      .mockImplementation(async (template) =>
        template.variaveis[3] === "09/2026"
          ? err(new ServicoExternoError("meta fora"))
          : enviarTemplate(template),
      );

    const andamento = await nucleo.execute({ cliente, agora });

    expect(andamento.enviado).toBe(true);
    expect(andamento.ocorrencias).toMatchObject([
      { tipo: "falha_envio", mensagem: expect.stringContaining("COD-a") },
    ]);
    expect(envio.templatesEnviados).toHaveLength(1);
    expect(registrados).toEqual([["a", "202610"]]);
    // A entrega recusada (202609) fica publicada, mas só a aceita grava o caminho no registro.
    expect(caminhos).toEqual(["c1/a/202610-hash.pdf"]);
  });

  it("CNPJ do Cliente ilegível: falha_envio e nada é enviado nem registrado", async () => {
    const { nucleo, envio, registrados } = montar(ok([parcelamento("p1", { interno: true })]), {
      cnpj: async () => err(new ServicoExternoError("banco fora")),
    });

    const andamento = await nucleo.execute({ cliente, agora });

    expect(andamento.enviado).toBe(false);
    expect(andamento.ocorrencias).toMatchObject([{ tipo: "falha_envio" }]);
    expect(envio.requisicoes).toHaveLength(0);
    expect(registrados).toEqual([]);
  });

  it("só veio a guia atrasada: ela é entregue, mas o mês corrente segue sem guia e avisa o setor", async () => {
    const { nucleo, registrados } = montar(ok([parcelamento("p1")]), {
      guias: async () => ok([guia("202609")]),
    });

    const andamento = await nucleo.execute({ cliente, agora });

    expect(registrados).toEqual([["p1", "202609"]]);
    expect(andamento.enviado).toBe(true);
    expect(andamento.ocorrencias).toMatchObject([
      { tipo: "parcelamento_sem_guia", mensagem: expect.stringContaining("COD-p1") },
    ]);
  });

  it("envio já registrado por outra execução não é erro", async () => {
    const { nucleo } = montar(ok([parcelamento("p1")]), {
      registrar: async () => ok("ja_registrado"),
    });

    expect(await nucleo.execute({ cliente, agora })).toEqual({ enviado: true, ocorrencias: [] });
  });

  it("falha ao ler os parcelamentos: falha_envio, sem chamar o provedor", async () => {
    const { nucleo, buscarGuiasParcelamento } = montar(err(new ServicoExternoError("banco fora")));

    const andamento = await nucleo.execute({ cliente, agora });

    expect(buscarGuiasParcelamento).not.toHaveBeenCalled();
    expect(andamento.ocorrencias).toMatchObject([{ tipo: "falha_envio" }]);
  });

  it("virada de mês: a parcela enviada em outubro não conta para novembro, que volta a ser pendente", async () => {
    const { nucleo, buscarGuiasParcelamento, registrados } = montar(
      ok([parcelamento("p1", { parcelasEnviadas: ["202610"] })]),
      { guias: async () => ok([guia("202611")]) },
    );

    const andamento = await nucleo.execute({ cliente, agora: new Date("2026-11-20T12:00:00Z") });

    expect(buscarGuiasParcelamento).toHaveBeenCalledWith("c1", ["202610"]);
    expect(andamento.enviado).toBe(true);
    expect(registrados).toEqual([["p1", "202611"]]);
  });

  it("entregue sem registro: avisa o setor e a rodada seguinte entrega de novo (pelo menos uma vez)", async () => {
    let registro: Result<EnvioRegistrado, AppError> = err(new ServicoExternoError("banco fora"));
    const { nucleo, envio } = montar(ok([parcelamento("p1")]), {
      registrar: async () => registro,
    });

    const primeira = await nucleo.execute({ cliente, agora });
    registro = ok("registrado");
    const segunda = await nucleo.execute({ cliente, agora });

    expect(primeira.enviado).toBe(true);
    expect(primeira.ocorrencias).toMatchObject([
      { tipo: "falha_envio", mensagem: expect.stringContaining("não foi registrado") },
    ]);
    expect(segunda).toEqual({ enviado: true, ocorrencias: [] });
    expect(envio.templatesEnviados).toHaveLength(2);
  });

  it("nova emissão da guia de quem já a recebeu não vai ao outro parcelamento", async () => {
    const { nucleo, registrados } = montar(
      ok([
        parcelamento("a", { valorParcelaCentavos: 30_000, parcelasEnviadas: ["202610"] }),
        parcelamento("b", { valorParcelaCentavos: 10_000 }),
      ]),
      { guias: async () => ok([guia("202610", 30_000), guia("202610", 10_000)]) },
    );

    await nucleo.execute({ cliente, agora });

    expect(registrados).toEqual([["b", "202610"]]);
  });

  it("acordo que quita na rodada: a guia de sobra não é entregue, não anuncia saldo negativo e vira ocorrência", async () => {
    const { nucleo, envio, registrados } = montar(
      ok([parcelamento("p1", { interno: true, parcelasRestantes: 1 })]),
      { guias: async () => ok([guia("202609"), guia("202610")]) },
    );

    const andamento = await nucleo.execute({ cliente, agora });

    expect(envio.templatesEnviados.map((t) => [t.variaveis[3], t.variaveis[4]])).toEqual([
      ["09/2026", "0"],
    ]);
    expect(registrados).toEqual([["p1", "202609"]]);
    expect(andamento.enviado).toBe(true);
    expect(andamento.ocorrencias).toMatchObject([
      { tipo: "falha_envio", mensagem: expect.stringContaining("10/2026 de sobra") },
    ]);
  });

  it("a guia de sobra de um acordo não vai a outro: o de valor maior fica sem guia", async () => {
    const { nucleo, registrados } = montar(
      ok([
        parcelamento("a", { parcelasRestantes: 1, valorParcelaCentavos: 10_000 }),
        parcelamento("b", { valorParcelaCentavos: 30_000 }),
      ]),
      {
        guias: async () =>
          ok([guia("202609", 10_000), guia("202610", 10_000), guia("202610", 30_000)]),
      },
    );

    await nucleo.execute({ cliente, agora });

    expect(registrados).toEqual([["a", "202609"]]);
  });

  it("acordo que deixou de estar em aberto durante a rodada: entregue sem registro vira ocorrência rastreável", async () => {
    const { nucleo } = montar(ok([parcelamento("p1")]), {
      registrar: async () => ok("nao_elegivel"),
    });

    const andamento = await nucleo.execute({ cliente, agora });

    expect(andamento.enviado).toBe(true);
    expect(andamento.ocorrencias).toMatchObject([
      { tipo: "falha_envio", mensagem: expect.stringContaining("deixou de estar em aberto") },
    ]);
  });

  it("a mesma guia reemitida na rodada seguinte não migra para outro acordo de mesmo valor", async () => {
    // a recebeu 202610 e b não; o provedor devolve o mesmo PDF (não se sabe de quem é).
    const { nucleo, envio, registrados } = montar(
      ok([parcelamento("a", { parcelasEnviadas: ["202610"] }), parcelamento("b")]),
      { guias: async () => ok([guia("202610", 10_000)]) },
    );

    const andamento = await nucleo.execute({ cliente, agora });

    expect(envio.templatesEnviados).toHaveLength(0);
    expect(registrados).toEqual([]);
    expect(andamento.ocorrencias).toMatchObject([
      { tipo: "parcelamento_sem_guia", mensagem: expect.stringContaining("COD-b") },
    ]);
  });

  it("guia de acordo já quitado, reemitida, não vai ao único acordo que sobrou", async () => {
    // a quitou depois de receber 202610 e saiu da lista; b é o único em aberto.
    const { nucleo, envio, registrados } = montar(ok([parcelamento("b")]), {
      guias: async () => ok([guia("202610", 10_000)]),
      entregues: [
        { parcelamentoId: "a", parcela: "202610", identidade: "202610:10000", caminho: null },
      ],
    });

    const andamento = await nucleo.execute({ cliente, agora });

    expect(envio.templatesEnviados).toHaveLength(0);
    expect(registrados).toEqual([]);
    expect(andamento.ocorrencias).toMatchObject([{ tipo: "parcelamento_sem_guia" }]);
  });

  it("guia reemitida de acordo de valor maior, só com valor corrigido, não vai ao de valor menor", async () => {
    // a (R$ 300) já recebeu 202610 e está em aberto; a reemissão vem com juros e b (R$ 100) é
    // candidato a ela: o grupo de maior valor é o de a, que já recebeu, então nada se atribui.
    const { nucleo, registrados } = montar(
      ok([
        parcelamento("a", { valorParcelaCentavos: 30_000, parcelasEnviadas: ["202610"] }),
        parcelamento("b", { valorParcelaCentavos: 10_000 }),
      ]),
      { guias: async () => ok([guia("202610", 30_500)]) },
    );

    await nucleo.execute({ cliente, agora });

    expect(registrados).toEqual([]);
  });

  describe("Parcelamento PGFN (#186)", () => {
    it("entrega as guias confirmadas até o mês corrente, da mais antiga à mais nova, com o PDF do banco e sem o provedor fiscal", async () => {
      const { nucleo, envio, registrados, identidades, lidos, buscarGuiasParcelamento } = montar(
        ok([]),
        { pgfn: ok([pgfn("g1", ["202610", "202609", "202611"])]) },
      );

      const andamento = await nucleo.execute({ cliente, agora });

      expect(andamento).toEqual({ enviado: true, ocorrencias: [] });
      expect(registrados).toEqual([
        ["g1", "202609"],
        ["g1", "202610"],
      ]);
      expect(identidades).toEqual(["202609:", "202610:"]);
      expect(lidos).toEqual(["c1/guias-pgfn/g1/202609.pdf", "c1/guias-pgfn/g1/202610.pdf"]);
      expect(envio.templatesEnviados.map((t) => t.documento?.nomeArquivo)).toEqual([
        "parcelamento-COD-g1-202609.pdf",
        "parcelamento-COD-g1-202610.pdf",
      ]);
      expect(buscarGuiasParcelamento).not.toHaveBeenCalled();
    });

    it("sem guia confirmada para entregar (sem guia, só futura ou já enviada): pula sem alerta", async () => {
      const { nucleo, envio, registrados } = montar(ok([]), {
        pgfn: ok([
          pgfn("g1", []),
          pgfn("g2", ["202611"]),
          pgfn("g3", ["202610"], { parcelasEnviadas: ["202610"] }),
        ]),
      });

      const andamento = await nucleo.execute({ cliente, agora });

      expect(andamento).toEqual({ enviado: false, ocorrencias: [] });
      expect(envio.templatesEnviados).toHaveLength(0);
      expect(registrados).toEqual([]);
    });

    it("guia que não pôde ser lida trava as seguintes do mesmo parcelamento e vira alerta", async () => {
      const { nucleo, registrados } = montar(ok([]), {
        pgfn: ok([pgfn("g1", ["202609", "202610"])]),
        lerFalha: true,
      });

      const andamento = await nucleo.execute({ cliente, agora });

      expect(andamento.enviado).toBe(false);
      expect(andamento.ocorrencias).toHaveLength(1);
      expect(registrados).toEqual([]);
    });

    it("falha de publicação da guia antiga trava as seguintes do acordo e não quita por elas (F2)", async () => {
      const { nucleo, registrados } = montar(ok([]), {
        pgfn: ok([pgfn("g1", ["202609", "202610"], { parcelasRestantes: 1 })]),
        publicarFalha: "202609",
      });

      const andamento = await nucleo.execute({ cliente, agora });

      expect(andamento.enviado).toBe(false);
      expect(andamento.ocorrencias).toHaveLength(1);
      expect(registrados).toEqual([]);
    });

    it("registro incerto da guia antiga trava as seguintes (F2)", async () => {
      const { nucleo, registrados } = montar(ok([]), {
        pgfn: ok([pgfn("g1", ["202609", "202610"], { parcelasRestantes: 1 })]),
        registrar: async () => err(new ServicoExternoError("banco")),
      });

      await nucleo.execute({ cliente, agora });

      expect(registrados).toEqual([["g1", "202609"]]);
    });

    it("a trava vale só para o acordo: outro acordo do Cliente segue entregue (F2)", async () => {
      const { nucleo, registrados } = montar(ok([]), {
        pgfn: ok([pgfn("g1", ["202609", "202610"]), pgfn("g2", ["202610"])]),
        publicarFalha: "202609",
      });

      const andamento = await nucleo.execute({ cliente, agora });

      expect(andamento.enviado).toBe(true);
      expect(registrados).toEqual([["g2", "202610"]]);
    });

    it("não entrega mais guias do que parcelas restantes", async () => {
      const { nucleo, registrados } = montar(ok([]), {
        pgfn: ok([pgfn("g1", ["202609", "202610"], { parcelasRestantes: 1 })]),
      });

      const andamento = await nucleo.execute({ cliente, agora });

      expect(registrados).toEqual([["g1", "202609"]]);
      expect(andamento.ocorrencias).toHaveLength(1);
    });

    it("entrega junto com o parcelamento da Receita do mesmo Cliente", async () => {
      const { nucleo, registrados } = montar(ok([parcelamento("p1")]), {
        pgfn: ok([pgfn("g1", ["202610"])]),
      });

      const andamento = await nucleo.execute({ cliente, agora });

      expect(andamento).toEqual({ enviado: true, ocorrencias: [] });
      expect(registrados).toEqual([
        ["p1", "202610"],
        ["g1", "202610"],
      ]);
    });

    it("PGFN interno vai ao financeiro, nunca ao Cliente", async () => {
      const { nucleo, envio } = montar(ok([]), {
        pgfn: ok([pgfn("g1", ["202610"], { interno: true })]),
      });

      await nucleo.execute({ cliente, agora });

      expect(envio.templatesEnviados).toMatchObject([
        { nome: "envio_guia_parcelamento_interno", telefone: telefoneFinanceiro },
      ]);
    });
  });
});
