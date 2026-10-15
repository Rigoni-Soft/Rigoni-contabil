import type { AlertaSetor } from "@/modules/atendimento/application/ports/out/alerta-setor.provider";
import type { ClienteParaParcelamento } from "@/modules/atendimento/application/ports/out/clientes-para-parcelamento.provider";
import type { EmailParaEnvio } from "@/modules/atendimento/application/ports/out/envio-email.provider";
import type { GuiaFiscal } from "@/modules/atendimento/application/ports/out/guias-fiscais.provider";
import { EnvioMensagemFalsoGateway } from "@/modules/atendimento/infra/gateways/envio-mensagem-falso.gateway";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok, type Result } from "@/shared/kernel/result";

import { EntregarComunicacaoPorCanais } from "./entregar-comunicacao-por-canais.use-case";
import { EnviarComunicacaoProativa } from "./enviar-comunicacao-proativa.use-case";
import { ExecutarEnvioGuiaParcelamento } from "./executar-envio-guia-parcelamento.use-case";
import { ObterGuiaParcelamentoParaEnvio } from "./obter-guia-parcelamento-para-envio.use-case";

// 22/10/2026 09:00 em São Paulo.
const diaDoJob = new Date("2026-10-22T12:00:00Z");
const telefone = "5511912345678";

function cliente(extra: Partial<ClienteParaParcelamento> = {}): ClienteParaParcelamento {
  return {
    clienteId: "c1",
    empresa: "3A Construções",
    formaEnvio: "whatsapp",
    contato: { nome: "Ângela", telefone },
    email: null,
    ultimaMensagemDoContatoEm: null,
    ...extra,
  };
}

const guiaOk: GuiaFiscal = {
  nomeArquivo: "parcelamento.pdf",
  pdfBase64: "JVBERi0=",
  parcela: "202609",
};

function montar(
  clientes: ClienteParaParcelamento[],
  opcoes: {
    agora?: Date;
    buscar?: () => Promise<Result<GuiaFiscal, AppError>>;
    falhas?: Record<string, number>;
    reivindicar?: Result<boolean, AppError>;
    desfazer?: Result<void, AppError>;
    gravacao?: Result<void, AppError>;
    resolver?: Result<void, AppError>;
  } = {},
) {
  const envio = new EnvioMensagemFalsoGateway(opcoes.falhas);
  const emails: EmailParaEnvio[] = [];
  const alertas: AlertaSetor[] = [];
  const reivindicados: string[] = [];
  const desfeitos: string[] = [];
  const resolvidos: Date[] = [];
  const buscar = jest.fn(opcoes.buscar ?? (async () => ok(guiaOk)));
  const job = new ExecutarEnvioGuiaParcelamento(
    {
      listarPendentes: async () => ok(clientes),
      reivindicar: async (id) => {
        reivindicados.push(id);
        return opcoes.reivindicar ?? ok(true);
      },
      desfazer: async (id) => {
        desfeitos.push(id);
        return opcoes.desfazer ?? ok(undefined);
      },
    },
    new ObterGuiaParcelamentoParaEnvio(
      { buscar },
      { publicar: async () => ok("https://storage.test/parcelamento.pdf") },
      0,
    ),
    new EntregarComunicacaoPorCanais(
      new EnviarComunicacaoProativa(envio, 3, 0),
      {
        enviar: async (email) => {
          emails.push(email);
          return ok(undefined);
        },
      },
      0,
    ),
    {
      alertar: async (alerta) => {
        alertas.push(alerta);
        return opcoes.gravacao ?? ok(undefined);
      },
      resolverNaoRenovados: async (desde) => {
        resolvidos.push(desde);
        return opcoes.resolver ?? ok(undefined);
      },
    },
    { agora: () => opcoes.agora ?? diaDoJob },
  );
  return { job, envio, emails, alertas, reivindicados, desfeitos, resolvidos, buscar };
}

beforeEach(() => {
  jest.spyOn(console, "info").mockImplementation(() => undefined);
});

describe("ExecutarEnvioGuiaParcelamento", () => {
  it.each([1, 15, 19, 21, 27, 29, 30])(
    "dia %i não é dia do job: não lê nem envia nada",
    async (dia) => {
      const { job, envio, buscar } = montar([cliente()], {
        agora: new Date(`2026-10-${String(dia).padStart(2, "0")}T15:00:00Z`),
      });
      const resultado = await job.execute();
      expect(resultado.ok && resultado.value.executado).toBe(false);
      expect(envio.requisicoes).toHaveLength(0);
      expect(buscar).not.toHaveBeenCalled();
    },
  );

  it.each([20, 22, 24, 26, 28])("dia %i é dia do job", async (dia) => {
    const { job } = montar([], { agora: new Date(`2026-10-${dia}T15:00:00Z`) });
    const resultado = await job.execute();
    expect(resultado.ok && resultado.value.executado).toBe(true);
  });

  it("usa o dia de São Paulo, não o UTC (19/10 às 22h em Brasília já é 20 em UTC)", async () => {
    const { job } = montar([], { agora: new Date("2026-10-20T01:00:00Z") });
    const resultado = await job.execute();
    expect(resultado.ok && resultado.value.executado).toBe(false);
  });

  it("Parcelamento pendente: envia a guia com a parcela pelo template e reivindica antes", async () => {
    const { job, envio, reivindicados, desfeitos } = montar([cliente()]);
    const resultado = await job.execute();
    expect(resultado.ok && resultado.value.enviados).toBe(1);
    expect(envio.templatesEnviados).toMatchObject([
      {
        nome: "envio_guia_parcelamento",
        telefone,
        variaveis: ["Ângela", "3A Construções", "09/2026"],
        documento: {
          url: "https://storage.test/parcelamento.pdf",
          nomeArquivo: "parcelamento.pdf",
        },
      },
    ]);
    expect(reivindicados).toEqual(["c1"]);
    expect(desfeitos).toHaveLength(0);
  });

  it("forma de envio e-mail: manda e-mail com a guia e não usa WhatsApp", async () => {
    const { job, envio, emails } = montar([
      cliente({ formaEnvio: "email", email: "ana@3a.com.br" }),
    ]);
    await job.execute();
    expect(envio.requisicoes).toHaveLength(0);
    expect(emails).toMatchObject([
      {
        para: "ana@3a.com.br",
        assunto: "Guia de parcelamento — 3A Construções",
        anexo: { url: "https://storage.test/parcelamento.pdf" },
      },
    ]);
  });

  it("sem destinatário: alerta uma vez, sem buscar a guia nem reivindicar", async () => {
    const { job, alertas, reivindicados, buscar } = montar([cliente({ contato: null })]);
    await job.execute();
    expect(reivindicados).toHaveLength(0);
    expect(buscar).not.toHaveBeenCalled();
    expect(alertas).toMatchObject([
      { setor: "simples_nacional", tipo: "contato_ausente", clienteId: "c1" },
    ]);
  });

  it("falha transitória do provedor fiscal: tenta de novo e envia sem alertar", async () => {
    let chamadas = 0;
    const { job, alertas, reivindicados } = montar([cliente()], {
      buscar: async () => {
        chamadas += 1;
        return chamadas < 3 ? err(new ServicoExternoError("503")) : ok(guiaOk);
      },
    });
    await job.execute();
    expect(chamadas).toBe(3);
    expect(alertas).toHaveLength(0);
    expect(reivindicados).toHaveLength(1);
  });

  it("provedor falha em todas as tentativas: alerta o setor e devolve o Parcelamento a pendente", async () => {
    const { job, alertas, desfeitos, buscar } = montar([cliente()], {
      buscar: async () => err(new ServicoExternoError("503")),
    });
    const resultado = await job.execute();
    expect(buscar).toHaveBeenCalledTimes(3);
    expect(alertas).toMatchObject([{ tipo: "falha_envio" }]);
    expect(desfeitos).toEqual(["c1"]);
    expect(resultado.ok && resultado.value.falhas).toBe(1);
    expect(resultado.ok && resultado.value.enviados).toBe(0);
  });

  it("sem autorização vigente: não repete, alerta de uma vez", async () => {
    const { job, alertas, buscar } = montar([cliente()], {
      buscar: async () => err(new ForbiddenError("sem autorização")),
    });
    await job.execute();
    expect(buscar).toHaveBeenCalledTimes(1);
    expect(alertas).toMatchObject([{ tipo: "falha_envio" }]);
  });

  it("guia sem parcela: falha em vez de enviar um template sem a variável", async () => {
    const { job, alertas, envio } = montar([cliente()], {
      buscar: async () => ok({ nomeArquivo: "p.pdf", pdfBase64: "JVBERi0=" }),
    });
    await job.execute();
    expect(envio.requisicoes).toHaveLength(0);
    expect(alertas).toMatchObject([{ tipo: "falha_envio" }]);
  });

  it("WhatsApp falha (limite de taxa): repete e depois alerta, sem marcar enviado", async () => {
    const { job, envio, alertas, desfeitos } = montar([cliente()], {
      falhas: { [telefone]: 130429 },
    });
    await job.execute();
    expect(envio.requisicoes).toHaveLength(3);
    expect(alertas).toMatchObject([{ tipo: "falha_envio" }]);
    expect(desfeitos).toEqual(["c1"]);
  });

  it("um Cliente que falha não impede os demais", async () => {
    const { job, desfeitos, envio } = montar(
      [
        cliente({ clienteId: "ruim", contato: { nome: "X", telefone: "5500" } }),
        cliente({ clienteId: "bom" }),
      ],
      { falhas: { "5500": 131026 } },
    );
    const resultado = await job.execute();
    expect(desfeitos).toEqual(["ruim"]);
    expect(envio.templatesEnviados).toHaveLength(1);
    expect(resultado.ok && resultado.value.enviados).toBe(1);
  });

  it("falha ao reivindicar vira alerta e nada é enviado", async () => {
    const { job, alertas, envio, buscar } = montar([cliente()], {
      reivindicar: err(new ServicoExternoError("banco")),
    });
    await job.execute();
    expect(alertas).toMatchObject([{ tipo: "falha_envio" }]);
    expect(envio.requisicoes).toHaveLength(0);
    expect(buscar).not.toHaveBeenCalled();
  });

  it("Parcelamento que outro job ou o Funcionário já tratou (reivindicação false): não envia nem alerta", async () => {
    const { job, envio, alertas, desfeitos } = montar([cliente()], { reivindicar: ok(false) });
    const resultado = await job.execute();
    expect(envio.requisicoes).toHaveLength(0);
    expect(alertas).toHaveLength(0);
    expect(desfeitos).toHaveLength(0);
    expect(resultado.ok && resultado.value.enviados).toBe(0);
  });

  it("não conseguir devolver o Parcelamento a pendente é falha própria", async () => {
    const { job, alertas } = montar([cliente()], {
      falhas: { [telefone]: 131026 },
      desfazer: err(new ServicoExternoError("banco")),
    });
    await job.execute();
    expect(alertas).toHaveLength(1);
    expect(alertas[0].mensagem).toContain("não voltou a pendente");
  });

  it("entrega por um canal só: envia, conta e alerta a entrega parcial sem desfazer", async () => {
    const { job, alertas, desfeitos } = montar(
      [cliente({ formaEnvio: "whatsapp_e_email", email: "ana@3a.com.br" })],
      { falhas: { [telefone]: 131026 } },
    );
    const resultado = await job.execute();
    expect(resultado.ok && resultado.value.enviados).toBe(1);
    expect(desfeitos).toHaveLength(0);
    expect(alertas.map((a) => a.tipo).sort()).toEqual(["entrega_parcial", "falha_envio"]);
  });

  it("ao fim da rodada resolve o que não foi renovado, com folga de relógio", async () => {
    const { job, resolvidos } = montar([cliente()]);
    await job.execute();
    expect(resolvidos).toEqual([new Date(diaDoJob.getTime() - 60_000)]);
  });

  it("alerta que não pôde ser gravado conta como falha e a rodada não resolve nada", async () => {
    const { job, resolvidos } = montar([cliente({ contato: null })], {
      gravacao: err(new ServicoExternoError("banco")),
    });
    const resultado = await job.execute();
    expect(resultado.ok && resultado.value.falhas).toBe(1);
    expect(resolvidos).toHaveLength(0);
  });

  it("falha ao ler os Clientes devolve o erro", async () => {
    const job = new ExecutarEnvioGuiaParcelamento(
      {
        listarPendentes: async () => err(new ServicoExternoError("banco")),
        reivindicar: async () => ok(true),
        desfazer: async () => ok(undefined),
      },
      { execute: async () => err(new ServicoExternoError("x")) },
      { execute: async () => err(new ServicoExternoError("x")) },
      { alertar: async () => ok(undefined), resolverNaoRenovados: async () => ok(undefined) },
      { agora: () => diaDoJob },
    );
    expect((await job.execute()).ok).toBe(false);
  });
});
