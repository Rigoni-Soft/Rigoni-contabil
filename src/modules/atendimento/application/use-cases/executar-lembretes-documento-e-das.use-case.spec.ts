import type { AlertaSetor } from "@/modules/atendimento/application/ports/out/alerta-setor.provider";
import type { ClienteParaLembrete } from "@/modules/atendimento/application/ports/out/clientes-para-lembrete.provider";
import type { EmailParaEnvio } from "@/modules/atendimento/application/ports/out/envio-email.provider";
import type { GuiaFiscal } from "@/modules/atendimento/application/ports/out/guias-fiscais.provider";
import { EnvioMensagemFalsoGateway } from "@/modules/atendimento/infra/gateways/envio-mensagem-falso.gateway";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok, type Result } from "@/shared/kernel/result";

import { EntregarComunicacaoPorCanais } from "./entregar-comunicacao-por-canais.use-case";
import { EnviarComunicacaoProativa } from "./enviar-comunicacao-proativa.use-case";
import { ExecutarLembretesDocumentoEDas } from "./executar-lembretes-documento-e-das.use-case";
import { ObterGuiaDasParaEnvio } from "./obter-guia-das-para-envio.use-case";

// 05/10/2026 09:00 em São Paulo.
const diaDoJob = new Date("2026-10-05T12:00:00Z");
const telefone = "5511912345678";

function cliente(extra: Partial<ClienteParaLembrete> = {}): ClienteParaLembrete {
  return {
    clienteId: "c1",
    empresa: "3A Construções",
    formaEnvio: "whatsapp",
    documentoObrigatorio: "positivo",
    dasStatus: "enviado",
    dataEnvioDas: null,
    contato: { nome: "Ângela", telefone },
    email: null,
    ultimaMensagemDoContatoEm: null,
    ...extra,
  };
}

const guiaOk: GuiaFiscal = {
  nomeArquivo: "das.pdf",
  pdfBase64: "JVBERi0=",
  competencia: "2026-09",
  vencimento: "2026-10-20",
};

function montar(
  clientes: ClienteParaLembrete[],
  opcoes: {
    agora?: Date;
    buscar?: () => Promise<Result<GuiaFiscal, AppError>>;
    falhas?: Record<string, number>;
    reservar?: Result<string | null, AppError>;
    // Por Cliente: sobrepõe `reservar` (um Cliente com a reserva ocupada ao lado de outro livre).
    reservarPor?: Record<string, Result<string | null, AppError>>;
    concluir?: Result<boolean, AppError>;
    liberar?: Result<void, AppError>;
    resolver?: Result<void, AppError>;
    gravacao?: Result<void, AppError>;
  } = {},
) {
  const envio = new EnvioMensagemFalsoGateway(opcoes.falhas);
  const emails: EmailParaEnvio[] = [];
  const alertas: AlertaSetor[] = [];
  const marcados: [string, string][] = [];
  const liberados: [string, string][] = [];
  // Quantos envios (WhatsApp + e-mail) já tinham saído quando cada conclusão foi pedida.
  const entregasAoConcluir: number[] = [];
  const resolvidos: { desde: Date; ids: string[] }[] = [];
  const buscar = jest.fn(opcoes.buscar ?? (async () => ok(guiaOk)));
  const descartadas: [string, string][] = [];
  const job = new ExecutarLembretesDocumentoEDas(
    {
      listar: async () => ok(clientes),
      obterDas: async () => ok(null),
      reservarDas: async (id) => opcoes.reservarPor?.[id] ?? opcoes.reservar ?? ok("tok-1"),
      concluirDas: async (id, _token, data) => {
        marcados.push([id, data]);
        entregasAoConcluir.push(envio.requisicoes.length + emails.length);
        return opcoes.concluir ?? ok(true);
      },
      liberarDas: async (id, token) => {
        liberados.push([id, token]);
        return opcoes.liberar ?? ok(undefined);
      },
    },
    new ObterGuiaDasParaEnvio(
      { buscar },
      {
        publicar: async () => ok("https://storage.test/das.pdf"),
        reencontrar: async () => ok(null),
        descartar: async () => undefined,
      },
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
      resolverNaoRenovados: async (desde, ids) => {
        resolvidos.push({ desde, ids });
        return opcoes.resolver ?? ok(undefined);
      },
    },
    { agora: () => opcoes.agora ?? diaDoJob },
    {
      descartar: async (clienteId, chave) => {
        descartadas.push([clienteId, chave.periodo]);
      },
    },
  );
  return {
    job,
    descartadas,
    envio,
    emails,
    alertas,
    marcados,
    liberados,
    entregasAoConcluir,
    resolvidos,
    buscar,
  };
}

beforeEach(() => {
  jest.spyOn(console, "info").mockImplementation(() => undefined);
});

describe("ExecutarLembretesDocumentoEDas", () => {
  it.each([2, 4, 11, 16, 20, 31])("dia %i não é dia do job: não lê nem envia nada", async (dia) => {
    const { job, envio, buscar } = montar([cliente({ documentoObrigatorio: "negativo" })], {
      agora: new Date(`2026-10-${String(dia).padStart(2, "0")}T15:00:00Z`),
    });
    const resultado = await job.execute();
    expect(resultado.ok && resultado.value.executado).toBe(false);
    expect(envio.requisicoes).toHaveLength(0);
    expect(buscar).not.toHaveBeenCalled();
  });

  it("usa o dia de São Paulo, não o UTC (01/10 às 22h em Brasília já é 02 em UTC)", async () => {
    const { job } = montar([], { agora: new Date("2026-10-02T01:00:00Z") });
    const resultado = await job.execute();
    expect(resultado.ok && resultado.value.executado).toBe(true);
  });

  it("documento obrigatório negativo: lembra o contato padrão pelo template (janela fechada)", async () => {
    const { job, envio } = montar([cliente({ documentoObrigatorio: "negativo" })]);
    const resultado = await job.execute();
    expect(resultado.ok && resultado.value.lembretes).toBe(1);
    expect(envio.templatesEnviados).toMatchObject([
      { nome: "lembrete_documento_obrigatorio", telefone, variaveis: ["Ângela", "3A Construções"] },
    ]);
  });

  it("janela de 24h aberta: o lembrete vai em formato próprio, sem template", async () => {
    const { job, envio } = montar([
      cliente({
        documentoObrigatorio: "negativo",
        ultimaMensagemDoContatoEm: new Date("2026-10-05T08:00:00Z"),
      }),
    ]);
    await job.execute();
    expect(envio.enviadas).toHaveLength(1);
    expect(envio.templatesEnviados).toHaveLength(0);
  });

  it("documento positivo ou não se aplica: não lembra", async () => {
    const { job, envio } = montar([
      cliente({ documentoObrigatorio: "positivo" }),
      cliente({ clienteId: "c2", documentoObrigatorio: "nao_se_aplica" }),
    ]);
    await job.execute();
    expect(envio.requisicoes).toHaveLength(0);
  });

  it("DAS pronto: envia a guia com competência e vencimento, marca enviado e grava a data", async () => {
    const { job, envio, marcados } = montar([cliente({ dasStatus: "pronto" })]);
    const resultado = await job.execute();
    expect(resultado.ok && resultado.value.dasEnviados).toBe(1);
    expect(envio.templatesEnviados).toMatchObject([
      {
        nome: "envio_guia_das",
        variaveis: ["Ângela", "3A Construções", "09/2026", "20/10/2026"],
        documento: { url: "https://storage.test/das.pdf", nomeArquivo: "das.pdf" },
      },
    ]);
    expect(marcados).toEqual([["c1", "2026-10-05"]]);
  });

  it("DAS pronto com a forma de envio e-mail: manda e-mail com a guia e não usa WhatsApp", async () => {
    const { job, envio, emails, marcados } = montar([
      cliente({ dasStatus: "pronto", formaEnvio: "email", email: "ana@3a.com.br" }),
    ]);
    await job.execute();
    expect(envio.requisicoes).toHaveLength(0);
    expect(emails).toMatchObject([
      {
        para: "ana@3a.com.br",
        assunto: "Guia do DAS — 3A Construções",
        anexo: { url: "https://storage.test/das.pdf" },
      },
    ]);
    expect(marcados).toHaveLength(1);
  });

  it("WhatsApp e e-mail: envia pelos dois", async () => {
    const { job, envio, emails } = montar([
      cliente({ dasStatus: "pronto", formaEnvio: "whatsapp_e_email", email: "ana@3a.com.br" }),
    ]);
    await job.execute();
    expect(envio.requisicoes).toHaveLength(1);
    expect(emails).toHaveLength(1);
  });

  it("forma de envio e-mail sem e-mail cadastrado: alerta o setor e o DAS segue pronto", async () => {
    const { job, alertas, marcados } = montar([
      cliente({ dasStatus: "pronto", formaEnvio: "email" }),
    ]);
    const resultado = await job.execute();
    expect(marcados).toHaveLength(0);
    expect(alertas).toMatchObject([
      { setor: "simples_nacional", tipo: "contato_ausente", clienteId: "c1" },
    ]);
    expect(resultado.ok && resultado.value.dasEnviados).toBe(0);
  });

  it("sem contato padrão: alerta o setor e o DAS segue pronto", async () => {
    const { job, alertas, marcados } = montar([cliente({ dasStatus: "pronto", contato: null })]);
    await job.execute();
    expect(marcados).toHaveLength(0);
    expect(alertas).toMatchObject([{ tipo: "contato_ausente" }]);
  });

  it("DAS pendente com documento positivo: alerta o setor", async () => {
    const { job, alertas, envio } = montar([
      cliente({ dasStatus: "pendente", documentoObrigatorio: "positivo" }),
    ]);
    const resultado = await job.execute();
    expect(alertas).toMatchObject([
      { setor: "simples_nacional", tipo: "das_pendente", clienteId: "c1" },
    ]);
    expect(envio.requisicoes).toHaveLength(0);
    expect(resultado.ok && resultado.value.alertas).toBe(1);
  });

  it("DAS pendente com documento negativo: só lembra, sem alertar", async () => {
    const { job, alertas } = montar([
      cliente({ dasStatus: "pendente", documentoObrigatorio: "negativo" }),
    ]);
    await job.execute();
    expect(alertas).toHaveLength(0);
  });

  it("falha transitória do Serpro: tenta de novo e envia sem alertar", async () => {
    let chamadas = 0;
    const { job, alertas, marcados } = montar([cliente({ dasStatus: "pronto" })], {
      buscar: async () => {
        chamadas += 1;
        return chamadas < 3 ? err(new ServicoExternoError("503")) : ok(guiaOk);
      },
    });
    await job.execute();
    expect(chamadas).toBe(3);
    expect(alertas).toHaveLength(0);
    expect(marcados).toHaveLength(1);
  });

  it("Serpro falha em todas as tentativas: alerta o setor e o DAS segue pronto", async () => {
    const { job, alertas, liberados, buscar } = montar([cliente({ dasStatus: "pronto" })], {
      buscar: async () => err(new ServicoExternoError("503")),
    });
    const resultado = await job.execute();
    expect(buscar).toHaveBeenCalledTimes(3);
    expect(alertas).toMatchObject([{ tipo: "falha_envio" }]);
    expect(liberados).toEqual([["c1", "tok-1"]]);
    expect(resultado.ok && resultado.value.falhas).toBe(1);
    expect(resultado.ok && resultado.value.dasEnviados).toBe(0);
  });

  it("sem autorização vigente: não repete, alerta de uma vez", async () => {
    const { job, alertas, buscar } = montar([cliente({ dasStatus: "pronto" })], {
      buscar: async () => err(new ForbiddenError("sem autorização")),
    });
    await job.execute();
    expect(buscar).toHaveBeenCalledTimes(1);
    expect(alertas).toMatchObject([{ tipo: "falha_envio" }]);
  });

  it("WhatsApp falha (limite de taxa): repete e depois alerta, sem concluir", async () => {
    const { job, envio, alertas, liberados } = montar([cliente({ dasStatus: "pronto" })], {
      falhas: { [telefone]: 130429 },
    });
    await job.execute();
    expect(envio.requisicoes).toHaveLength(3);
    expect(alertas).toMatchObject([{ tipo: "falha_envio" }]);
    expect(liberados).toEqual([["c1", "tok-1"]]);
  });

  it("um Cliente que falha não impede os demais", async () => {
    const { job, liberados } = montar(
      [
        cliente({
          clienteId: "ruim",
          dasStatus: "pronto",
          contato: { nome: "X", telefone: "5500" },
        }),
        cliente({ clienteId: "bom", dasStatus: "pronto" }),
      ],
      { falhas: { "5500": 131026 } },
    );
    await job.execute();
    expect(liberados).toEqual([["ruim", "tok-1"]]);
  });

  it("falha ao reservar o DAS vira alerta e nada é enviado", async () => {
    const { job, alertas, envio, buscar } = montar([cliente({ dasStatus: "pronto" })], {
      reservar: err(new ServicoExternoError("banco")),
    });
    const resultado = await job.execute();
    expect(alertas).toMatchObject([{ tipo: "falha_envio" }]);
    expect(envio.requisicoes).toHaveLength(0);
    expect(buscar).not.toHaveBeenCalled();
    expect(resultado.ok && resultado.value.dasEnviados).toBe(0);
  });

  it("DAS que outro job ou o Funcionário já tratou (reserva nula): não envia nem conta", async () => {
    const { job, envio, alertas, liberados } = montar([cliente({ dasStatus: "pronto" })], {
      reservar: ok(null),
    });
    const resultado = await job.execute();
    expect(envio.requisicoes).toHaveLength(0);
    expect(alertas).toHaveLength(0);
    expect(liberados).toHaveLength(0);
    expect(resultado.ok && resultado.value.dasEnviados).toBe(0);
  });

  it("entrega falhou: libera a reserva e não conclui (o cadastro nunca saiu de pronto)", async () => {
    const { job, liberados, marcados, descartadas } = montar(
      [cliente({ dasStatus: "pronto", dataEnvioDas: "2026-09-10" })],
      { falhas: { [telefone]: 131026 } },
    );
    await job.execute();
    expect(liberados).toEqual([["c1", "tok-1"]]);
    expect(marcados).toHaveLength(0);
    expect(descartadas).toEqual([["c1", "202610"]]);
  });

  it("entrega concluída não libera a reserva nem descarta a guia", async () => {
    const { job, liberados, descartadas } = montar([cliente({ dasStatus: "pronto" })]);
    await job.execute();
    expect(liberados).toHaveLength(0);
    expect(descartadas).toHaveLength(0);
  });

  it("sem destinatário: alerta uma vez, sem buscar a guia nem reservar o DAS", async () => {
    const { job, alertas, marcados, buscar } = montar([
      cliente({ documentoObrigatorio: "negativo", dasStatus: "pronto", contato: null }),
    ]);
    const resultado = await job.execute();
    expect(alertas).toMatchObject([{ tipo: "contato_ausente" }]);
    expect(marcados).toHaveLength(0);
    expect(buscar).not.toHaveBeenCalled();
    expect(resultado.ok && resultado.value.alertas).toBe(1);
  });

  it("rodada sem Clientes não chama a resolução de alertas", async () => {
    const { job, resolvidos } = montar([]);
    await job.execute();
    expect(resolvidos).toEqual([]);
  });

  it("resolve com folga sobre o relógio e só os Clientes avaliados", async () => {
    const { job, resolvidos } = montar([cliente({ clienteId: "a" }), cliente({ clienteId: "b" })]);
    await job.execute();
    expect(resolvidos).toEqual([{ desde: new Date(diaDoJob.getTime() - 60_000), ids: ["a", "b"] }]);
  });

  it("entrega interrompida por exceção: mantém a reserva (resultado incerto), alerta e segue", async () => {
    let chamada = 0;
    const { job, alertas, marcados, liberados, envio } = montar(
      [
        cliente({ clienteId: "cai", dasStatus: "pronto" }),
        cliente({ clienteId: "bom", dasStatus: "pronto" }),
      ],
      {
        buscar: async () => {
          chamada += 1;
          if (chamada === 1) throw new Error("processo caiu");
          return ok(guiaOk);
        },
      },
    );
    const resultado = await job.execute();
    expect(marcados).toEqual([["bom", "2026-10-05"]]);
    expect(liberados).toHaveLength(0);
    expect(alertas).toMatchObject([{ tipo: "falha_envio", clienteId: "cai" }]);
    expect(envio.templatesEnviados).toHaveLength(1);
    expect(resultado.ok && resultado.value.dasEnviados).toBe(1);
  });

  it("DAS com a reserva ocupada: o Cliente não entra na resolução, mesmo com o lembrete enviado", async () => {
    const { job, resolvidos, envio } = montar(
      [
        cliente({ clienteId: "ocupado", documentoObrigatorio: "negativo", dasStatus: "pronto" }),
        cliente({ clienteId: "livre", documentoObrigatorio: "negativo", dasStatus: "pronto" }),
      ],
      { reservarPor: { ocupado: ok(null) } },
    );
    const resultado = await job.execute();
    // O lembrete do Cliente ocupado saiu, mas a tarefa do DAS não foi reavaliada: ele fica de fora.
    expect(envio.templatesEnviados.map((t) => t.nome).sort()).toEqual([
      "envio_guia_das",
      "lembrete_documento_obrigatorio",
      "lembrete_documento_obrigatorio",
    ]);
    expect(resolvidos.map((r) => r.ids)).toEqual([["livre"]]);
    expect(resultado.ok && resultado.value.lembretes).toBe(2);
    expect(resultado.ok && resultado.value.dasEnviados).toBe(1);
  });

  it("todos os Clientes com a reserva ocupada: nenhum alerta é resolvido", async () => {
    const { job, resolvidos } = montar(
      [
        cliente({ clienteId: "a", dasStatus: "pronto" }),
        cliente({ clienteId: "b", dasStatus: "pronto" }),
      ],
      { reservar: ok(null) },
    );
    await job.execute();
    expect(resolvidos).toHaveLength(0);
  });

  it("conclui só depois de a entrega ser aceita", async () => {
    const { job, entregasAoConcluir } = montar([cliente({ dasStatus: "pronto" })]);
    await job.execute();
    expect(entregasAoConcluir).toEqual([1]);
  });

  it("entrega aceita mas conclusão sem a posse da reserva: conta como enviado e alerta o setor", async () => {
    const { job, alertas, liberados } = montar([cliente({ dasStatus: "pronto" })], {
      concluir: ok(false),
    });
    const resultado = await job.execute();
    expect(resultado.ok && resultado.value.dasEnviados).toBe(1);
    expect(liberados).toHaveLength(0);
    expect(alertas).toMatchObject([{ tipo: "falha_envio" }]);
    expect(alertas[0].mensagem).toContain("o cadastro não foi atualizado");
  });

  it("não conseguir liberar a reserva é falha própria", async () => {
    const { job, alertas } = montar([cliente({ dasStatus: "pronto" })], {
      falhas: { [telefone]: 131026 },
      liberar: err(new ServicoExternoError("banco")),
    });
    await job.execute();
    expect(alertas[0].mensagem).toContain("a reserva não foi liberada");
  });

  it("falha ao ler os Clientes devolve o erro e não resolve alertas", async () => {
    const resolver = jest.fn(async () => ok(undefined));
    const job = new ExecutarLembretesDocumentoEDas(
      {
        listar: async () => err(new ServicoExternoError("banco")),
        obterDas: async () => ok(null),
        reservarDas: async () => ok("t"),
        concluirDas: async () => ok(true),
        liberarDas: async () => ok(undefined),
      },
      { execute: async () => err(new ServicoExternoError("x")) },
      { execute: async () => err(new ServicoExternoError("x")) },
      { alertar: async () => ok(undefined), resolverNaoRenovados: resolver },
      { agora: () => diaDoJob },
      { descartar: async () => undefined },
    );
    expect((await job.execute()).ok).toBe(false);
    expect(resolver).not.toHaveBeenCalled();
  });

  it("falha ao resolver os alertas conta como falha da rodada", async () => {
    const { job } = montar([cliente()], { resolver: err(new ServicoExternoError("banco")) });
    const resultado = await job.execute();
    expect(resultado.ok && resultado.value.falhas).toBe(1);
  });

  it("whatsapp_e_email com e-mail ausente: entrega pelo WhatsApp, mantém enviado e abre entrega_parcial", async () => {
    const { job, envio, alertas, liberados } = montar([
      cliente({ dasStatus: "pronto", formaEnvio: "whatsapp_e_email", email: null }),
    ]);
    const resultado = await job.execute();
    expect(envio.requisicoes).toHaveLength(1);
    expect(liberados).toHaveLength(0);
    expect(resultado.ok && resultado.value.dasEnviados).toBe(1);
    expect(alertas.map((a) => a.tipo).sort()).toEqual(["contato_ausente", "entrega_parcial"]);
  });

  it("whatsapp_e_email entregue pelos dois canais: sem alerta de entrega parcial", async () => {
    const { job, alertas } = montar([
      cliente({ dasStatus: "pronto", formaEnvio: "whatsapp_e_email", email: "ana@3a.com.br" }),
    ]);
    await job.execute();
    expect(alertas).toHaveLength(0);
  });

  it("forma de envio de um canal só que falha: falha_envio, sem entrega_parcial", async () => {
    const { job, alertas } = montar([cliente({ dasStatus: "pronto" })], {
      falhas: { [telefone]: 131026 },
    });
    await job.execute();
    expect(alertas.map((a) => a.tipo)).toEqual(["falha_envio"]);
  });

  it("lembrete entregue por um canal só não abre entrega_parcial (volta a sair na próxima rodada)", async () => {
    const { job, alertas } = montar([
      cliente({ documentoObrigatorio: "negativo", formaEnvio: "whatsapp_e_email", email: null }),
    ]);
    await job.execute();
    expect(alertas.map((a) => a.tipo)).toEqual(["contato_ausente"]);
  });

  it("falha do lembrete e da guia no mesmo Cliente: um alerta só, com as duas mensagens", async () => {
    const { job, alertas } = montar(
      [cliente({ documentoObrigatorio: "negativo", dasStatus: "pronto" })],
      { falhas: { [telefone]: 131026 } },
    );
    await job.execute();
    expect(alertas).toHaveLength(1);
    expect(alertas[0].tipo).toBe("falha_envio");
    expect(alertas[0].mensagem.split(" | ")).toHaveLength(2);
  });

  it("alerta que não pôde ser gravado: não resolve os alertas antigos e conta como falha", async () => {
    const { job, resolvidos } = montar([cliente({ dasStatus: "pendente" })], {
      gravacao: err(new ServicoExternoError("banco")),
    });
    const resultado = await job.execute();
    expect(resolvidos).toHaveLength(0);
    expect(resultado.ok && resultado.value.falhas).toBe(1);
  });
});
