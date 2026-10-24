import type { CadastroFiscalCliente } from "@/modules/atendimento/application/ports/out/cliente-cnpj.provider";
import type { ClienteParaParcelamento } from "@/modules/atendimento/application/ports/out/clientes-para-parcelamento.provider";
import type { GuiaFiscal } from "@/modules/atendimento/application/ports/out/guias-fiscais.provider";
import type { ParcelamentoDoCliente } from "@/modules/atendimento/application/ports/out/parcelamentos-do-cliente.provider";
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
    registrar?: (id: string, parcela: string) => Promise<Result<boolean, AppError>>;
    // Telefone do financeiro; null = não configurado.
    financeiro?: string | null;
    cnpj?: () => Promise<Result<CadastroFiscalCliente, AppError>>;
  } = {},
) {
  const envio = new EnvioMensagemFalsoGateway();
  const emails: unknown[] = [];
  const registrados: [string, string][] = [];
  const publicadas: unknown[] = [];
  const ignorados: (readonly string[])[] = [];
  const buscarGuiasParcelamento = jest.fn(async (_: string, ignorar: readonly string[]) => {
    ignorados.push(ignorar);
    return (await opcoes.guias?.()) ?? ok([guia("202610")]);
  });
  const nucleo = new EnviarGuiasParcelamento(
    {
      listarEmAberto: async () => parcelamentos,
      registrarEnvio: async (id, parcela) => {
        registrados.push([id, parcela]);
        return opcoes.registrar?.(id, parcela) ?? ok(true);
      },
    },
    { buscarGuiasParcelamento },
    {
      publicar: async (_clienteId, _guia, destino) => {
        publicadas.push(destino);
        return ok(`https://storage.test/${destino?.id}/${destino?.parcela}.pdf`);
      },
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
    0,
  );
  return { nucleo, envio, emails, registrados, publicadas, ignorados, buscarGuiasParcelamento };
}

describe("EnviarGuiasParcelamento", () => {
  beforeEach(() => {
    jest.spyOn(console, "info").mockImplementation(() => undefined);
  });

  it("entrega a guia do parcelamento em aberto e registra o envio da parcela", async () => {
    const { nucleo, envio, registrados, publicadas } = montar(ok([parcelamento("p1")]));

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
    expect(publicadas).toEqual([{ id: "p1", parcela: "202610" }]);
    expect(registrados).toEqual([["p1", "202610"]]);
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

  it("dois parcelamentos: cada guia vai ao seu e a falha do registro de um não trava o outro", async () => {
    const { nucleo, envio, registrados } = montar(
      ok([
        parcelamento("p1", { valorParcelaCentavos: 10_000 }),
        parcelamento("p2", { valorParcelaCentavos: 30_000 }),
      ]),
      {
        guias: async () => ok([guia("202610", 10_000), guia("202610", 30_000)]),
        registrar: async (id) =>
          id === "p1" ? err(new ServicoExternoError("banco fora")) : ok(true),
      },
    );

    const andamento = await nucleo.execute({ cliente, agora });

    expect(envio.templatesEnviados).toHaveLength(2);
    expect(registrados).toEqual([
      ["p1", "202610"],
      ["p2", "202610"],
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
      ok([
        parcelamento("comum", { valorParcelaCentavos: 10_000 }),
        parcelamento("interno", {
          interno: true,
          valorParcelaCentavos: 30_000,
          parcelasRestantes: 7,
        }),
      ]),
      { guias: async () => ok([guia("202610", 10_000), guia("202610", 30_000)]) },
    );

    const andamento = await nucleo.execute({ cliente, agora });

    expect(andamento).toEqual({ enviado: true, ocorrencias: [] });
    expect(envio.templatesEnviados).toMatchObject([
      { nome: "envio_guia_parcelamento", telefone },
      {
        nome: "envio_guia_parcelamento_interno",
        telefone: telefoneFinanceiro,
        idioma: "pt_BR",
        variaveis: ["3A Construções", "12345678000190", "COD-interno", "10/2026", "7"],
        documento: { url: "https://storage.test/interno/202610.pdf", nomeArquivo: "202610.pdf" },
      },
    ]);
    expect(registrados).toEqual([
      ["comum", "202610"],
      ["interno", "202610"],
    ]);
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

  it("Cliente sem contato recebe o interno no financeiro; só o comum fica com contato_ausente", async () => {
    const { nucleo, envio } = montar(
      ok([
        parcelamento("comum", { valorParcelaCentavos: 10_000 }),
        parcelamento("interno", { interno: true, valorParcelaCentavos: 30_000 }),
      ]),
      { guias: async () => ok([guia("202610", 10_000), guia("202610", 30_000)]) },
    );

    const andamento = await nucleo.execute({
      cliente: { ...cliente, contato: null, email: null },
      agora,
    });

    expect(andamento.enviado).toBe(true);
    expect(andamento.ocorrencias).toMatchObject([{ tipo: "contato_ausente" }]);
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

  it("uma mensagem por guia: a falha de entrega de um interno vira falha_envio e não afeta o outro", async () => {
    const { nucleo, envio, registrados } = montar(
      ok([
        parcelamento("a", { interno: true, valorParcelaCentavos: 10_000 }),
        parcelamento("b", { interno: true, valorParcelaCentavos: 30_000 }),
      ]),
      { guias: async () => ok([guia("202610", 10_000), guia("202610", 30_000)]) },
    );
    const enviarTemplate = envio.enviarTemplate.bind(envio);
    jest
      .spyOn(envio, "enviarTemplate")
      .mockImplementation(async (template) =>
        template.variaveis[2] === "COD-a"
          ? err(new ServicoExternoError("meta fora"))
          : enviarTemplate(template),
      );

    const andamento = await nucleo.execute({ cliente, agora });

    expect(andamento.enviado).toBe(true);
    expect(andamento.ocorrencias).toMatchObject([
      { tipo: "falha_envio", mensagem: expect.stringContaining("COD-a") },
    ]);
    expect(envio.templatesEnviados).toHaveLength(1);
    expect(registrados).toEqual([["b", "202610"]]);
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
    const { nucleo } = montar(ok([parcelamento("p1")]), { registrar: async () => ok(false) });

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
    let registro: Result<boolean, AppError> = err(new ServicoExternoError("banco fora"));
    const { nucleo, envio } = montar(ok([parcelamento("p1")]), {
      registrar: async () => registro,
    });

    const primeira = await nucleo.execute({ cliente, agora });
    registro = ok(true);
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
});
