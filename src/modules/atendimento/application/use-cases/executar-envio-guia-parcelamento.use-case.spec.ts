import { SEM_ANDAMENTO } from "@/modules/atendimento/application/jobs/alertas-da-rodada";
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
import { EnviarGuiasParcelamento } from "./enviar-guias-parcelamento.use-case";
import { ExecutarEnvioGuiaParcelamento } from "./executar-envio-guia-parcelamento.use-case";

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
  parcela: "202610",
};
const emAberto = {
  id: "p1",
  codigo: "PARC-1",
  interno: false,
  valorParcelaCentavos: 10_000,
  parcelasRestantes: 5,
};

function montar(
  clientes: ClienteParaParcelamento[],
  opcoes: {
    agora?: Date;
    buscar?: () => Promise<Result<GuiaFiscal[], AppError>>;
    falhas?: Record<string, number>;
    reservar?: Result<string | null, AppError>;
    // Por Cliente: sobrepõe `reservar` (um Cliente com a reserva ocupada ao lado de outro livre).
    reservarPor?: Record<string, Result<string | null, AppError>>;
    concluir?: Result<boolean, AppError>;
    liberar?: Result<void, AppError>;
    gravacao?: Result<void, AppError>;
    resolver?: Result<void, AppError>;
  } = {},
) {
  const envio = new EnvioMensagemFalsoGateway(opcoes.falhas);
  const emails: EmailParaEnvio[] = [];
  const alertas: AlertaSetor[] = [];
  const reservados: string[] = [];
  const concluidos: [string, string][] = [];
  const liberados: [string, string][] = [];
  // Quantos templates já tinham saído quando cada conclusão foi pedida: concluir é depois do envio.
  const entregasAoConcluir: number[] = [];
  const resolvidos: { desde: Date; ids: string[] }[] = [];
  const buscar = jest.fn(opcoes.buscar ?? (async () => ok([guiaOk])));
  const job = new ExecutarEnvioGuiaParcelamento(
    {
      listarPendentes: async () => ok(clientes),
      reservar: async (id) => {
        reservados.push(id);
        return opcoes.reservarPor?.[id] ?? opcoes.reservar ?? ok("tok-1");
      },
      concluir: async (id, token) => {
        concluidos.push([id, token]);
        entregasAoConcluir.push(envio.templatesEnviados.length + emails.length);
        return opcoes.concluir ?? ok(true);
      },
      liberar: async (id, token) => {
        liberados.push([id, token]);
        return opcoes.liberar ?? ok(undefined);
      },
    },
    new EnviarGuiasParcelamento(
      {
        listarEmAberto: async () => ok([{ ...emAberto, parcelasEnviadas: [] }]),
        contarComuns: async () => ok(0),
        guiasEntregues: async () => ok([]),
        registrarEnvio: async () => ok("registrado"),
      },
      { buscarGuiasParcelamento: buscar },
      {
        publicar: async () =>
          ok({
            url: "https://storage.test/parcelamento.pdf",
            caminho: "c1/p1/202610-hash.pdf",
          }),
        reencontrar: async () => ok("https://storage.test/parcelamento.pdf"),
      },
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
        envio,
        cnpjs: { cadastroFiscalDoCliente: async () => ok({ cnpj: "12345678000190", regime: "" }) },
        telefone: null,
      },
      {
        listarEmAberto: async () => ok([]),
        ler: async () => ok(""),
        reservar: async () => ok(true),
        liberar: async () => ok(undefined),
      },
      0,
    ),
    {
      alertar: async (alerta) => {
        alertas.push(alerta);
        return opcoes.gravacao ?? ok(undefined);
      },
      resolverNaoRenovados: async (desde, ids) => {
        resolvidos.push({ desde, ids });
        return opcoes.resolver ?? ok(undefined);
      },
    },
    { agora: () => opcoes.agora ?? diaDoJob },
  );
  return {
    job,
    envio,
    emails,
    alertas,
    reservados,
    concluidos,
    liberados,
    entregasAoConcluir,
    resolvidos,
    buscar,
  };
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

  it("Parcelamento pendente: envia a guia com a parcela pelo template, reserva antes e conclui depois do envio", async () => {
    const { job, envio, reservados, concluidos, liberados } = montar([cliente()]);
    const resultado = await job.execute();
    expect(resultado.ok && resultado.value.enviados).toBe(1);
    expect(envio.templatesEnviados).toMatchObject([
      {
        nome: "envio_guia_parcelamento",
        telefone,
        variaveis: ["Ângela", "3A Construções", "10/2026"],
        documento: {
          url: "https://storage.test/parcelamento.pdf",
          nomeArquivo: "parcelamento.pdf",
        },
      },
    ]);
    expect(reservados).toEqual(["c1"]);
    expect(concluidos).toEqual([["c1", "tok-1"]]);
    expect(liberados).toHaveLength(0);
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

  it("sem destinatário: alerta uma vez, sem buscar a guia nem concluir, e libera a reserva", async () => {
    const { job, alertas, liberados, concluidos, buscar } = montar([cliente({ contato: null })]);
    await job.execute();
    expect(liberados).toEqual([["c1", "tok-1"]]);
    expect(concluidos).toHaveLength(0);
    expect(buscar).not.toHaveBeenCalled();
    expect(alertas).toMatchObject([
      { setor: "simples_nacional", tipo: "contato_ausente", clienteId: "c1" },
    ]);
  });

  it("falha transitória do provedor fiscal: tenta de novo e envia sem alertar", async () => {
    let chamadas = 0;
    const { job, alertas, reservados } = montar([cliente()], {
      buscar: async () => {
        chamadas += 1;
        return chamadas < 3 ? err(new ServicoExternoError("503")) : ok([guiaOk]);
      },
    });
    await job.execute();
    expect(chamadas).toBe(3);
    expect(alertas).toHaveLength(0);
    expect(reservados).toHaveLength(1);
  });

  it("provedor falha em todas as tentativas: alerta o setor e libera a reserva e o Parcelamento segue pendente", async () => {
    const { job, alertas, liberados, buscar } = montar([cliente()], {
      buscar: async () => err(new ServicoExternoError("503")),
    });
    const resultado = await job.execute();
    expect(buscar).toHaveBeenCalledTimes(3);
    expect(alertas).toMatchObject([{ tipo: "falha_envio" }]);
    expect(liberados).toEqual([["c1", "tok-1"]]);
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

  it("guia sem parcela: não é enviada e o parcelamento fica sem guia, avisando o setor", async () => {
    const { job, alertas, envio } = montar([cliente()], {
      buscar: async () => ok([{ nomeArquivo: "p.pdf", pdfBase64: "JVBERi0=" }]),
    });
    await job.execute();
    expect(envio.requisicoes).toHaveLength(0);
    expect(alertas).toMatchObject([{ tipo: "parcelamento_sem_guia" }]);
  });

  it("WhatsApp falha (limite de taxa): repete e depois alerta, sem concluir", async () => {
    const { job, envio, alertas, liberados } = montar([cliente()], {
      falhas: { [telefone]: 130429 },
    });
    await job.execute();
    expect(envio.requisicoes).toHaveLength(3);
    expect(alertas).toMatchObject([{ tipo: "falha_envio" }]);
    expect(liberados).toEqual([["c1", "tok-1"]]);
  });

  it("um Cliente que falha não impede os demais", async () => {
    const { job, liberados, envio } = montar(
      [
        cliente({ clienteId: "ruim", contato: { nome: "X", telefone: "5500" } }),
        cliente({ clienteId: "bom" }),
      ],
      { falhas: { "5500": 131026 } },
    );
    const resultado = await job.execute();
    expect(liberados).toEqual([["ruim", "tok-1"]]);
    expect(envio.templatesEnviados).toHaveLength(1);
    expect(resultado.ok && resultado.value.enviados).toBe(1);
  });

  it("falha ao reservar vira alerta e nada é enviado", async () => {
    const { job, alertas, envio, buscar } = montar([cliente()], {
      reservar: err(new ServicoExternoError("banco")),
    });
    await job.execute();
    expect(alertas).toMatchObject([{ tipo: "falha_envio" }]);
    expect(envio.requisicoes).toHaveLength(0);
    expect(buscar).not.toHaveBeenCalled();
  });

  it("Parcelamento que outro job ou o Funcionário já tratou (reserva nula): não envia nem alerta", async () => {
    const { job, envio, alertas, liberados } = montar([cliente()], { reservar: ok(null) });
    const resultado = await job.execute();
    expect(envio.requisicoes).toHaveLength(0);
    expect(alertas).toHaveLength(0);
    expect(liberados).toHaveLength(0);
    expect(resultado.ok && resultado.value.enviados).toBe(0);
  });

  it("não conseguir liberar a reserva é falha própria", async () => {
    const { job, alertas } = montar([cliente()], {
      falhas: { [telefone]: 131026 },
      liberar: err(new ServicoExternoError("banco")),
    });
    await job.execute();
    expect(alertas).toHaveLength(1);
    expect(alertas[0].mensagem).toContain("a reserva não foi liberada");
  });

  it("entrega por um canal só: envia, conta e alerta a entrega parcial e conclui sem liberar", async () => {
    const { job, alertas, liberados } = montar(
      [cliente({ formaEnvio: "whatsapp_e_email", email: "ana@3a.com.br" })],
      { falhas: { [telefone]: 131026 } },
    );
    const resultado = await job.execute();
    expect(resultado.ok && resultado.value.enviados).toBe(1);
    expect(liberados).toHaveLength(0);
    expect(alertas.map((a) => a.tipo).sort()).toEqual(["entrega_parcial", "falha_envio"]);
  });

  it("ao fim da rodada resolve o que não foi renovado, com folga de relógio", async () => {
    const { job, resolvidos } = montar([cliente()]);
    await job.execute();
    expect(resolvidos).toEqual([{ desde: new Date(diaDoJob.getTime() - 60_000), ids: ["c1"] }]);
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
    const resolvidos: string[] = [];
    const job = new ExecutarEnvioGuiaParcelamento(
      {
        listarPendentes: async () => err(new ServicoExternoError("banco")),
        reservar: async () => ok("tok-1"),
        concluir: async () => ok(true),
        liberar: async () => ok(undefined),
      },
      { execute: async () => SEM_ANDAMENTO },
      {
        alertar: async () => ok(undefined),
        resolverNaoRenovados: async () => {
          resolvidos.push("chamado");
          return ok(undefined);
        },
      },
      { agora: () => diaDoJob },
    );
    expect((await job.execute()).ok).toBe(false);
    // Leitura incompleta não vira "rodada concluída": nenhum alerta é resolvido.
    expect(resolvidos).toHaveLength(0);
  });

  it("entrega interrompida por exceção: mantém a reserva (resultado incerto), alerta e segue", async () => {
    let chamada = 0;
    const { job, alertas, concluidos, liberados, envio } = montar(
      [cliente({ clienteId: "cai" }), cliente({ clienteId: "bom" })],
      {
        buscar: async () => {
          chamada += 1;
          if (chamada === 1) throw new Error("processo caiu");
          return ok([guiaOk]);
        },
      },
    );
    const resultado = await job.execute();
    // Sem conclusão e sem liberação: o cadastro segue pendente e a reserva expira sozinha.
    expect(concluidos).toEqual([["bom", "tok-1"]]);
    expect(liberados).toHaveLength(0);
    expect(alertas).toMatchObject([{ tipo: "falha_envio", clienteId: "cai" }]);
    expect(envio.templatesEnviados).toHaveLength(1);
    expect(resultado.ok && resultado.value.enviados).toBe(1);
  });

  it("conclui só depois de a entrega ser aceita", async () => {
    const { job, entregasAoConcluir } = montar([cliente()]);
    await job.execute();
    expect(entregasAoConcluir).toEqual([1]);
  });

  it("entrega aceita mas conclusão sem a posse da reserva: conta como enviado e alerta o setor", async () => {
    const { job, alertas, liberados } = montar([cliente()], { concluir: ok(false) });
    const resultado = await job.execute();
    expect(resultado.ok && resultado.value.enviados).toBe(1);
    expect(liberados).toHaveLength(0);
    expect(alertas).toMatchObject([{ tipo: "falha_envio" }]);
    expect(alertas[0].mensagem).toContain("o cadastro não foi atualizado");
  });

  it("entrega aceita mas erro ao concluir: conta como enviado e alerta, sem liberar", async () => {
    const { job, alertas, liberados } = montar([cliente()], {
      concluir: err(new ServicoExternoError("banco")),
    });
    const resultado = await job.execute();
    expect(resultado.ok && resultado.value.enviados).toBe(1);
    expect(liberados).toHaveLength(0);
    expect(alertas[0].mensagem).toContain("o cadastro não foi atualizado");
  });

  it("resolve alertas só dos Clientes avaliados na rodada", async () => {
    const { job, resolvidos } = montar([cliente({ clienteId: "a" }), cliente({ clienteId: "b" })]);
    await job.execute();
    expect(resolvidos.map((r) => r.ids)).toEqual([["a", "b"]]);
  });

  it("reserva ocupada (resultado ainda incerto): o Cliente não entra na resolução de alertas", async () => {
    const { job, resolvidos, alertas, envio } = montar(
      [cliente({ clienteId: "ocupado" }), cliente({ clienteId: "livre" })],
      { reservarPor: { ocupado: ok(null) } },
    );
    const resultado = await job.execute();
    // Só o Cliente efetivamente reavaliado participa; o ocupado mantém o alerta anterior.
    expect(resolvidos.map((r) => r.ids)).toEqual([["livre"]]);
    expect(alertas).toHaveLength(0);
    expect(envio.templatesEnviados).toHaveLength(1);
    expect(resultado.ok && resultado.value.enviados).toBe(1);
  });

  it("todos os Clientes com a reserva ocupada: nenhum alerta é resolvido", async () => {
    const { job, resolvidos } = montar([cliente({ clienteId: "a" }), cliente({ clienteId: "b" })], {
      reservar: ok(null),
    });
    await job.execute();
    expect(resolvidos).toHaveLength(0);
  });

  it("rodada sem Clientes não chama a resolução de alertas", async () => {
    const { job, resolvidos } = montar([]);
    await job.execute();
    expect(resolvidos).toHaveLength(0);
  });
});
