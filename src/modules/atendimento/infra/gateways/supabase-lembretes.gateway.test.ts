/**
 * Integração infra ↔ Supabase (testes.md, seção 3) do job de lembrete de documento e DAS:
 * leitura paginada dos Clientes, janela de 24h pela chave nacional do telefone, reserva/conclusão do
 * envio do DAS com posse por token, alertas por Cliente e guia publicada. Destrutiva: só roda no
 * Supabase local e limpa pelos IDs da própria execução. Requer `npx supabase start`.
 */
import { EntregarComunicacaoPorCanais } from "@/modules/atendimento/application/use-cases/entregar-comunicacao-por-canais.use-case";
import { EntregarDasNaUra } from "@/modules/atendimento/application/use-cases/entregar-das-na-ura.use-case";
import { EnviarComunicacaoProativa } from "@/modules/atendimento/application/use-cases/enviar-comunicacao-proativa.use-case";
import { ExecutarLembretesDocumentoEDas } from "@/modules/atendimento/application/use-cases/executar-lembretes-documento-e-das.use-case";
import { ObterGuiaDasParaEnvio } from "@/modules/atendimento/application/use-cases/obter-guia-das-para-envio.use-case";
import { URA_ATOR_ID } from "@/modules/atendimento/domain/services/inatividade.service";
import { soDigitosNacionais } from "@/modules/atendimento/domain/services/telefone.service";
import { ok as sucesso } from "@/shared/kernel/result";

import { criarAdminLocal } from "../../../../../test-support/admin-supabase-local";
import { EnvioMensagemFalsoGateway } from "./envio-mensagem-falso.gateway";
import { SupabaseAlertaSetorGateway } from "./supabase-alerta-setor.gateway";
import { SupabaseClientesParaLembreteGateway } from "./supabase-clientes-para-lembrete.gateway";
import { SupabaseGuiaPublicadaGateway } from "./supabase-guia-publicada.gateway";

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

// O destino é validado antes de o client existir: remoto falha alto, sem tocar em dados alheios.
const admin = criarAdminLocal(SERVICE_KEY);
const clientes = new SupabaseClientesParaLembreteGateway(admin);
const alertas = new SupabaseAlertaSetorGateway(admin, "lembretes");
const guias = new SupabaseGuiaPublicadaGateway(admin);

const sufixo = String(Date.now()).slice(-8);
const HORA_MS = 60 * 60 * 1000;

type Fixture = { id: string; cnpj: string; nacional: string };
const criados: Fixture[] = [];
const atendimentos: string[] = [];
let sequencia = 0;

function cnpjUnico(): string {
  sequencia += 1;
  return `7${sufixo}${String(sequencia).padStart(5, "0")}`.slice(0, 14);
}

async function ok<T>(consulta: PromiseLike<{ data: T; error: { message: string } | null }>) {
  const { data, error } = await consulta;
  if (error) throw new Error(error.message);
  // Quem lê (select) recebe o dado; insert/update sem retorno não usa o valor.
  return data as NonNullable<T>;
}

// Cliente com cadastro (DAS pronto) e o contato padrão com o telefone dado, como o Admin o digita.
async function criarCliente(telefoneCadastrado: string): Promise<Fixture> {
  const nacional = soDigitosNacionais(telefoneCadastrado);
  const fixture = { id: crypto.randomUUID(), cnpj: cnpjUnico(), nacional };
  await ok(
    admin.from("clientes").insert({
      id: fixture.id,
      empresa: `Lembrete ${nacional} Ltda`,
      cnpj: fixture.cnpj,
      regime: "simples_nacional",
      email: "financeiro@lembrete.test",
    }),
  );
  criados.push(fixture);
  await ok(
    admin.from("cliente_cadastro_operacional_sn").upsert({
      cliente_id: fixture.id,
      forma_envio: "whatsapp_e_email",
      documento_obrigatorio: "negativo",
      das_status: "pronto",
    }),
  );
  await ok(
    admin.from("cliente_contatos").insert({
      id: crypto.randomUUID(),
      cliente_id: fixture.id,
      nome: "Ângela",
      telefone: telefoneCadastrado,
      padrao: true,
    }),
  );
  return fixture;
}

// O Atendimento como o recebimento o grava: telefone com DDI, chave nacional (`soDigitosNacionais`).
async function criarAtendimento(fixture: Fixture, mensagens: { autor: string; ha: number }[]) {
  const telefone = `55${fixture.nacional}`;
  const criado = await ok(
    admin
      .from("atendimentos")
      .insert({
        telefone,
        chave_telefone: soDigitosNacionais(telefone),
        cliente_id: fixture.id,
        setor: "recepcao",
      })
      .select("id")
      .single(),
  );
  atendimentos.push(criado.id);
  if (mensagens.length > 0) {
    await ok(
      admin.from("mensagens").insert(
        mensagens.map((m) => ({
          atendimento_id: criado.id,
          autor: m.autor,
          texto: "teste",
          criado_em: new Date(Date.now() - m.ha).toISOString(),
        })),
      ),
    );
  }
}

async function doLista(id: string) {
  const lista = await clientes.listar();
  if (!lista.ok) throw new Error("listar falhou");
  const encontrado = lista.value.find((c) => c.clienteId === id);
  if (!encontrado) throw new Error("Cliente fora da lista");
  return encontrado;
}

// A decisão real do job: janela aberta → texto livre; fechada → template.
async function tipoDeEnvio(id: string): Promise<"template" | "texto"> {
  const c = await doLista(id);
  const envio = new EnvioMensagemFalsoGateway();
  jest.spyOn(console, "info").mockImplementation(() => undefined);
  await new EnviarComunicacaoProativa(envio).execute({
    telefone: c.contato!.telefone,
    comunicacao: {
      tipo: "lembrete_documento_obrigatorio",
      contato: "Ângela",
      empresa: "Teste",
    },
    ultimaMensagemDoContatoEm: c.ultimaMensagemDoContatoEm,
    agora: new Date(),
  });
  return envio.templatesEnviados.length > 0 ? "template" : "texto";
}

async function statusDoDas(id: string) {
  return ok(
    admin
      .from("cliente_cadastro_operacional_sn")
      .select("das_status, data_envio_das")
      .eq("cliente_id", id)
      .single(),
  );
}

let principal: Fixture;
const publicados: string[] = [];

beforeAll(async () => {
  // 11 dígitos, digitado com máscara.
  principal = await criarCliente(`(11) 9${sufixo.slice(0, 4)}-${sufixo.slice(4)}`);
});

afterAll(async () => {
  const erros: string[] = [];
  const registrar = (rotulo: string, e: { message: string } | null) => {
    if (e) erros.push(`${rotulo}: ${e.message}`);
  };
  // O filtro vai na URL: em lotes, para a lista de 1.001 Clientes não estourar o tamanho dela.
  const emLotes = async <T>(
    itens: T[],
    apagar: (lote: T[]) => PromiseLike<{ error: { message: string } | null }>,
    rotulo: string,
  ) => {
    for (let i = 0; i < itens.length; i += 100) {
      registrar(rotulo, (await apagar(itens.slice(i, i + 100))).error);
    }
  };
  // Alertas e reservas saem em cascata com o Cliente.
  await emLotes(
    atendimentos,
    (l) => admin.from("atendimentos").delete().in("id", l),
    "atendimentos",
  );
  await emLotes(
    criados.map((c) => c.cnpj),
    (l) => admin.from("registros_auditoria").delete().in("alvo", l),
    "auditoria",
  );
  await emLotes(
    criados.map((c) => c.id),
    (l) => admin.from("clientes").delete().in("id", l),
    "clientes",
  );
  if (publicados.length > 0) {
    registrar("storage", (await admin.storage.from("guias-fiscais").remove(publicados)).error);
  }
  expect(erros).toEqual([]);
});

describe("leitura dos Clientes e janela de 24h", () => {
  it("telefone de envio com DDI e sem mensagem do contato: janela fechada, template", async () => {
    const c = await doLista(principal.id);

    expect(c).toMatchObject({
      email: "financeiro@lembrete.test",
      formaEnvio: "whatsapp_e_email",
      documentoObrigatorio: "negativo",
      dasStatus: "pronto",
      contato: { nome: "Ângela", telefone: `55${principal.nacional}` },
      ultimaMensagemDoContatoEm: null,
    });
    expect(await tipoDeEnvio(principal.id)).toBe("template");
  });

  it("Atendimento gravado como o recebimento (chave nacional): mensagem recente abre a janela", async () => {
    await criarAtendimento(principal, [
      { autor: "contato", ha: HORA_MS },
      { autor: "ura", ha: 60_000 },
    ]);

    const c = await doLista(principal.id);

    expect(c.ultimaMensagemDoContatoEm).toBeInstanceOf(Date);
    // A última do contato (1 h), não a da URA (1 min).
    const idade = Date.now() - c.ultimaMensagemDoContatoEm!.getTime();
    expect(idade).toBeGreaterThan(HORA_MS - 30_000);
    expect(idade).toBeLessThan(HORA_MS + 30_000);
    expect(await tipoDeEnvio(principal.id)).toBe("texto");
  });

  it("mensagem do contato com mais de 24 h: janela fechada, template", async () => {
    const antigo = await criarCliente(`(11) 9${sufixo.slice(1, 5)}-${sufixo.slice(0, 4)}`);
    await criarAtendimento(antigo, [{ autor: "contato", ha: 30 * HORA_MS }]);

    expect((await doLista(antigo.id)).ultimaMensagemDoContatoEm).toBeInstanceOf(Date);
    expect(await tipoDeEnvio(antigo.id)).toBe("template");
  });

  it("fixo de 10 dígitos: telefone de envio com 55 e janela pela chave nacional", async () => {
    const fixo = await criarCliente(`(11) 3${sufixo.slice(0, 3)}-${sufixo.slice(3, 7)}`);
    await criarAtendimento(fixo, [{ autor: "contato", ha: HORA_MS }]);

    const c = await doLista(fixo.id);

    expect(fixo.nacional).toHaveLength(10);
    expect(c.contato?.telefone).toBe(`55${fixo.nacional}`);
    expect(await tipoDeEnvio(fixo.id)).toBe("texto");
  });

  it("contato cadastrado já com o 55: o telefone de envio não duplica o DDI", async () => {
    const nacional = `118${sufixo.slice(0, 8)}`;
    const com55 = await criarCliente(`55${nacional}`);
    await criarAtendimento(com55, [{ autor: "contato", ha: HORA_MS }]);

    const c = await doLista(com55.id);

    expect(c.contato?.telefone).toBe(`55${nacional}`);
    expect(await tipoDeEnvio(com55.id)).toBe("texto");
  });
});

describe("reserva e conclusão do envio do DAS", () => {
  async function recolocarPronto(id: string) {
    await ok(
      admin
        .from("cliente_cadastro_operacional_sn")
        .update({ das_status: "pronto", data_envio_das: null })
        .eq("cliente_id", id),
    );
  }

  it("reservar não muda o DAS; a segunda reserva vigente devolve null", async () => {
    const token = await clientes.reservarDas(principal.id);

    expect(token.ok && typeof token.value).toBe("string");
    expect(await statusDoDas(principal.id)).toEqual({ das_status: "pronto", data_envio_das: null });
    expect(await clientes.reservarDas(principal.id)).toEqual({ ok: true, value: null });
  });

  it("token desconhecido não conclui nem altera o cadastro", async () => {
    const conclusao = await clientes.concluirDas(principal.id, crypto.randomUUID(), "2026-10-05");

    expect(conclusao).toEqual({ ok: true, value: false });
    expect(await statusDoDas(principal.id)).toEqual({ das_status: "pronto", data_envio_das: null });
  });

  it("concluir com o token da reserva: enviado com a data e uma auditoria da URA", async () => {
    await admin.from("envios_automaticos").delete().eq("cliente_id", principal.id);
    const reserva = await clientes.reservarDas(principal.id);
    const token = reserva.ok ? reserva.value! : "";

    expect(await clientes.concluirDas(principal.id, token, "2026-10-05")).toEqual({
      ok: true,
      value: true,
    });

    expect(await statusDoDas(principal.id)).toEqual({
      das_status: "enviado",
      data_envio_das: "2026-10-05",
    });
    const auditoria = await ok(
      admin
        .from("registros_auditoria")
        .select("ator, setor, acao, resultado")
        .eq("alvo", principal.cnpj),
    );
    expect(auditoria).toEqual([
      {
        ator: URA_ATOR_ID,
        setor: "simples_nacional",
        acao: "cliente.enviar-das-automatico",
        resultado: "sucesso",
      },
    ]);
    // Já concluída: o mesmo token não conclui de novo e não há nova reserva (DAS não está pronto).
    expect(await clientes.concluirDas(principal.id, token, "2026-10-10")).toEqual({
      ok: true,
      value: false,
    });
    expect(await clientes.reservarDas(principal.id)).toEqual({ ok: true, value: null });
  });

  it("liberar devolve a reserva sem tocar no cadastro; token antigo não libera a de outra tentativa", async () => {
    await recolocarPronto(principal.id);
    const a = await clientes.reservarDas(principal.id);
    const tokenA = a.ok ? a.value! : "";

    expect(await clientes.liberarDas(principal.id, tokenA)).toEqual({ ok: true, value: undefined });
    expect(await statusDoDas(principal.id)).toEqual({ das_status: "pronto", data_envio_das: null });

    const b = await clientes.reservarDas(principal.id);
    const tokenB = b.ok ? b.value! : "";
    expect(tokenB).not.toBe(tokenA);
    // O token A é antigo: liberar não derruba a reserva B, que conclui normalmente.
    await clientes.liberarDas(principal.id, tokenA);
    expect(await clientes.reservarDas(principal.id)).toEqual({ ok: true, value: null });
    expect(await clientes.concluirDas(principal.id, tokenB, "2026-10-05")).toEqual({
      ok: true,
      value: true,
    });
  });

  it("reserva expirada é retomada; o token antigo e a alteração do cadastro entre A e B não sobrescrevem", async () => {
    await recolocarPronto(principal.id);
    await admin.from("envios_automaticos").delete().eq("cliente_id", principal.id);
    const a = await clientes.reservarDas(principal.id);
    const tokenA = a.ok ? a.value! : "";

    // A queda deixou a reserva A para trás; o Funcionário mexe no cadastro e o recoloca em pronto.
    await ok(
      admin
        .from("envios_automaticos")
        .update({ reservado_em: new Date(Date.now() - HORA_MS).toISOString() })
        .eq("cliente_id", principal.id),
    );
    await ok(
      admin
        .from("cliente_cadastro_operacional_sn")
        .update({ das_status: "pendente" })
        .eq("cliente_id", principal.id),
    );
    expect(await clientes.reservarDas(principal.id)).toEqual({ ok: true, value: null });
    await recolocarPronto(principal.id);

    const b = await clientes.reservarDas(principal.id);
    const tokenB = b.ok ? b.value! : "";
    expect(tokenB).not.toBe(tokenA);
    expect(await clientes.concluirDas(principal.id, tokenB, "2026-10-15")).toEqual({
      ok: true,
      value: true,
    });

    // A volta atrasada: sem posse, não altera a conclusão de B nem a data.
    expect(await clientes.concluirDas(principal.id, tokenA, "2026-10-01")).toEqual({
      ok: true,
      value: false,
    });
    expect(await statusDoDas(principal.id)).toEqual({
      das_status: "enviado",
      data_envio_das: "2026-10-15",
    });
  });

  it("o Funcionário marcou o DAS durante a entrega: concluir devolve false e não duplica a auditoria", async () => {
    await recolocarPronto(principal.id);
    await admin.from("envios_automaticos").delete().eq("cliente_id", principal.id);
    await ok(admin.from("registros_auditoria").delete().eq("alvo", principal.cnpj));
    const reserva = await clientes.reservarDas(principal.id);
    const token = reserva.ok ? reserva.value! : "";

    await ok(
      admin
        .from("cliente_cadastro_operacional_sn")
        .update({ das_status: "enviado", data_envio_das: "2026-10-04" })
        .eq("cliente_id", principal.id),
    );

    expect(await clientes.concluirDas(principal.id, token, "2026-10-05")).toEqual({
      ok: true,
      value: false,
    });
    expect(await statusDoDas(principal.id)).toEqual({
      das_status: "enviado",
      data_envio_das: "2026-10-04",
    });
    const auditoria = await ok(
      admin.from("registros_auditoria").select("acao").eq("alvo", principal.cnpj),
    );
    expect(auditoria).toEqual([]);
  });

  it("duas reservas simultâneas: só uma recebe o token", async () => {
    await recolocarPronto(principal.id);
    await admin.from("envios_automaticos").delete().eq("cliente_id", principal.id);

    const [x, y] = await Promise.all([
      clientes.reservarDas(principal.id),
      clientes.reservarDas(principal.id),
    ]);

    const tokens = [x, y].map((r) => (r.ok ? r.value : "erro"));
    expect(tokens.filter((t) => typeof t === "string" && t !== "erro")).toHaveLength(1);
    expect(tokens.filter((t) => t === null)).toHaveLength(1);
  });
});

describe("leitura completa por páginas", () => {
  it("1.001 Clientes além do teto do PostgREST: todos aparecem, uma vez, em ordem de cliente_id", async () => {
    const lote: Fixture[] = [];
    for (let i = 0; i < 1001; i += 1) {
      lote.push({ id: crypto.randomUUID(), cnpj: cnpjUnico(), nacional: "" });
    }
    for (let i = 0; i < lote.length; i += 500) {
      const parte = lote.slice(i, i + 500);
      await ok(
        admin.from("clientes").insert(
          parte.map((c) => ({
            id: c.id,
            empresa: "Volume Ltda",
            cnpj: c.cnpj,
            regime: "simples_nacional",
          })),
        ),
      );
      criados.push(...parte);
      await ok(
        admin
          .from("cliente_cadastro_operacional_sn")
          .upsert(parte.map((c) => ({ cliente_id: c.id, forma_envio: "whatsapp" }))),
      );
    }

    const lista = await clientes.listar();

    expect(lista.ok).toBe(true);
    const ids = lista.ok ? lista.value.map((c) => c.clienteId) : [];
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(1001);
    const nossos = new Set(lote.map((c) => c.id));
    const aparecem = ids.filter((id) => nossos.has(id));
    expect(aparecem).toHaveLength(1001);
    expect(ids).toEqual([...ids].sort());
  }, 120_000);
});

describe("alertas do setor", () => {
  const alerta = (clienteId: string, tipo: "das_pendente" | "falha_envio" | "entrega_parcial") =>
    ({ setor: "simples_nacional", tipo, clienteId, mensagem: "x" }) as const;

  async function abertos(clienteId: string) {
    return ok(
      admin
        .from("alertas_setor")
        .select("tipo")
        .eq("cliente_id", clienteId)
        .is("resolvido_em", null),
    );
  }

  it("repetir o alerta renova a mensagem em vez de empilhar", async () => {
    await alertas.alertar({ ...alerta(principal.id, "das_pendente"), mensagem: "primeira" });
    await alertas.alertar({ ...alerta(principal.id, "das_pendente"), mensagem: "segunda" });

    const linhas = await ok(
      admin
        .from("alertas_setor")
        .select("mensagem")
        .eq("cliente_id", principal.id)
        .eq("tipo", "das_pendente")
        .is("resolvido_em", null),
    );
    expect(linhas).toEqual([{ mensagem: "segunda" }]);
  });

  it("resolve só os Clientes avaliados e preserva a entrega parcial", async () => {
    const outro = await criarCliente("(11) 98888-0000");
    await alertas.alertar(alerta(principal.id, "falha_envio"));
    await alertas.alertar(alerta(principal.id, "entrega_parcial"));
    await alertas.alertar(alerta(outro.id, "falha_envio"));

    // "Avaliado" é só o `principal`: o alerta do `outro` não pode ser resolvido por esta rodada.
    await alertas.resolverNaoRenovados(new Date(Date.now() + 60_000), [principal.id]);

    expect(await abertos(principal.id)).toEqual([{ tipo: "entrega_parcial" }]);
    expect(await abertos(outro.id)).toEqual([{ tipo: "falha_envio" }]);
  });

  it("lista vazia de Clientes não resolve nada", async () => {
    await alertas.alertar(alerta(principal.id, "falha_envio"));

    await alertas.resolverNaoRenovados(new Date(Date.now() + 60_000), []);

    expect(await abertos(principal.id)).toEqual(expect.arrayContaining([{ tipo: "falha_envio" }]));
  });
});

describe("rodada real com a reserva ocupada", () => {
  it("segunda rodada com a reserva vigente não resolve o alerta de falha do DAS, mesmo com o lembrete enviado", async () => {
    const alvo = await criarCliente(`(11) 97${sufixo.slice(0, 3)}-${sufixo.slice(3, 7)}`);
    // Só o Cliente do teste participa da rodada (o banco local pode ter outros).
    const apenasOAlvo = {
      listar: async () => {
        const todos = await clientes.listar();
        return todos.ok ? sucesso(todos.value.filter((c) => c.clienteId === alvo.id)) : todos;
      },
      reservarDas: (id: string) => clientes.reservarDas(id),
      concluirDas: (id: string, token: string, data: string) =>
        clientes.concluirDas(id, token, data),
      liberarDas: (id: string, token: string) => clientes.liberarDas(id, token),
    };
    let quedaNaEntrega = true;
    const envio = new EnvioMensagemFalsoGateway();
    let relogioDaRodada = new Date();
    const alertasNoRelogioDaRodada = {
      alertar: async (alerta: Parameters<typeof alertas.alertar>[0]) => {
        const resultado = await alertas.alertar(alerta);
        await admin
          .from("alertas_setor")
          .update({ criado_em: relogioDaRodada.toISOString() })
          .eq("cliente_id", alerta.clienteId)
          .eq("tipo", alerta.tipo)
          .eq("origem", "lembretes")
          .is("resolvido_em", null);
        return resultado;
      },
      resolverNaoRenovados: (desde: Date, ids: string[]) =>
        alertas.resolverNaoRenovados(desde, ids),
    };
    jest.spyOn(console, "info").mockImplementation(() => undefined);
    const montar = (agora: Date) => {
      relogioDaRodada = agora;
      return new ExecutarLembretesDocumentoEDas(
        apenasOAlvo,
        new ObterGuiaDasParaEnvio(
          {
            buscar: async () => {
              if (quedaNaEntrega) throw new Error("processo caiu");
              return sucesso({
                nomeArquivo: "das.pdf",
                pdfBase64: "JVBERi0=",
                competencia: "2026-09",
                vencimento: "2026-10-20",
              });
            },
          },
          { publicar: async () => sucesso("https://storage.test/das.pdf") },
          0,
        ),
        new EntregarComunicacaoPorCanais(
          new EnviarComunicacaoProativa(envio, 1, 0),
          { enviar: async () => sucesso(undefined) },
          0,
        ),
        alertasNoRelogioDaRodada,
        { agora: () => agora },
      );
    };
    const abertos = async () =>
      ok(
        admin
          .from("alertas_setor")
          .select("tipo")
          .eq("cliente_id", alvo.id)
          .eq("origem", "lembretes")
          .is("resolvido_em", null),
      );
    const diaDoJob = new Date("2026-10-05T12:00:00Z");

    // T0: o lembrete sai, a entrega do DAS cai; falha_envio aberto, reserva vigente, DAS pronto.
    await montar(diaDoJob).execute();
    expect(await abertos()).toEqual([{ tipo: "falha_envio" }]);
    expect((await statusDoDas(alvo.id)).das_status).toBe("pronto");
    const lembretesNaPrimeira = envio.templatesEnviados.length;
    expect(lembretesNaPrimeira).toBeGreaterThan(0);

    // T0 + 2 min: o lembrete sai de novo, mas a reserva do DAS devolve null: nada é concluído e o
    // alerta da tarefa não reavaliada continua aberto.
    quedaNaEntrega = false;
    await montar(new Date(diaDoJob.getTime() + 2 * 60_000)).execute();
    expect((await statusDoDas(alvo.id)).das_status).toBe("pronto");
    expect(await abertos()).toEqual([{ tipo: "falha_envio" }]);

    // A reserva vence: a retomada entrega, conclui o DAS e só então resolve o alerta.
    await ok(
      admin
        .from("envios_automaticos")
        .update({ reservado_em: new Date(Date.now() - 20 * 60_000).toISOString() })
        .eq("cliente_id", alvo.id),
    );
    await montar(new Date(diaDoJob.getTime() + 4 * 60_000)).execute();
    expect((await statusDoDas(alvo.id)).das_status).toBe("enviado");
    expect(await abertos()).toEqual([]);
  }, 60_000);
});

describe("guia publicada", () => {
  it("publica o PDF no bucket e devolve um link assinado", async () => {
    const link = await guias.publicar(principal.id, {
      nomeArquivo: "das.pdf",
      pdfBase64: Buffer.from("%PDF-1.4 teste").toString("base64"),
    });

    expect(link.ok && link.value).toContain("/guias-fiscais/");
    const url = link.ok ? link.value : "";
    // O objeto é limpo no teardown pelo caminho que o link carrega.
    const caminho = new URL(url).pathname.split("/guias-fiscais/")[1];
    if (caminho) publicados.push(decodeURIComponent(caminho));
    const baixado = await fetch(url);
    expect(baixado.status).toBe(200);
    expect(await baixado.text()).toBe("%PDF-1.4 teste");
  });
});

describe("DAS pedido pela URA (#124)", () => {
  const AGORA = new Date("2026-10-05T12:00:00Z");
  const PDF = "%PDF-1.4 das da ura";
  let alvo: Fixture;
  let chamadasAoProvedor = 0;
  const provedor = {
    buscar: async () => {
      chamadasAoProvedor += 1;
      return sucesso({
        nomeArquivo: "das.pdf",
        pdfBase64: Buffer.from(PDF).toString("base64"),
        competencia: "2026-09",
        vencimento: "2026-10-20",
      });
    },
  };
  const guiaDas = new ObterGuiaDasParaEnvio(provedor, guias, 0);
  const montarUra = (envio: EnvioMensagemFalsoGateway) =>
    new EntregarDasNaUra(clientes, guiaDas, guias, envio, { agora: () => AGORA });

  beforeAll(async () => {
    alvo = await criarCliente(`(21) 9${sufixo.slice(0, 4)}-${sufixo.slice(4)}`);
    publicados.push(`${alvo.id}/das/202610.pdf`);
  });

  it("DAS pendente: avisa o contato, sem provedor, reserva nem alerta ao setor", async () => {
    await ok(
      admin
        .from("cliente_cadastro_operacional_sn")
        .update({ das_status: "pendente" })
        .eq("cliente_id", alvo.id),
    );
    const envio = new EnvioMensagemFalsoGateway();
    chamadasAoProvedor = 0;

    const r = await montarUra(envio).execute({ clienteId: alvo.id, telefone: "5521999990000" });

    expect(r.ok).toBe(true);
    expect(envio.enviadas).toHaveLength(1);
    expect(envio.documentosEnviados).toHaveLength(0);
    expect(chamadasAoProvedor).toBe(0);
    expect(
      await ok(admin.from("envios_automaticos").select("tipo").eq("cliente_id", alvo.id)),
    ).toEqual([]);
    expect(await ok(admin.from("alertas_setor").select("tipo").eq("cliente_id", alvo.id))).toEqual(
      [],
    );
    expect(await statusDoDas(alvo.id)).toEqual({ das_status: "pendente", data_envio_das: null });
  });

  it("DAS pronto: a URA entrega, marca enviado com a data e a URA como ator, e o job do mês não reenvia", async () => {
    await ok(
      admin
        .from("cliente_cadastro_operacional_sn")
        .update({ das_status: "pronto" })
        .eq("cliente_id", alvo.id),
    );
    const envio = new EnvioMensagemFalsoGateway();
    chamadasAoProvedor = 0;

    const r = await montarUra(envio).execute({ clienteId: alvo.id, telefone: "5521999990000" });

    expect(r.ok).toBe(true);
    expect(envio.documentosEnviados).toHaveLength(1);
    expect(chamadasAoProvedor).toBe(1);
    expect(await statusDoDas(alvo.id)).toEqual({
      das_status: "enviado",
      data_envio_das: "2026-10-05",
    });
    const auditoria = await ok(
      admin
        .from("registros_auditoria")
        .select("ator, setor, acao, resultado")
        .eq("alvo", alvo.cnpj),
    );
    expect(auditoria).toEqual([
      {
        ator: URA_ATOR_ID,
        setor: "simples_nacional",
        acao: "cliente.enviar-das-automatico",
        resultado: "sucesso",
      },
    ]);

    // O job do mesmo dia lê o Cliente já enviado: não reenvia nem chama o provedor.
    const envioDoJob = new EnvioMensagemFalsoGateway();
    jest.spyOn(console, "info").mockImplementation(() => undefined);
    const apenasOAlvo = {
      listar: async () => {
        const todos = await clientes.listar();
        return todos.ok ? sucesso(todos.value.filter((c) => c.clienteId === alvo.id)) : todos;
      },
      reservarDas: (id: string) => clientes.reservarDas(id),
      concluirDas: (id: string, token: string, data: string) =>
        clientes.concluirDas(id, token, data),
      liberarDas: (id: string, token: string) => clientes.liberarDas(id, token),
    };
    const rodada = await new ExecutarLembretesDocumentoEDas(
      apenasOAlvo,
      guiaDas,
      new EntregarComunicacaoPorCanais(
        new EnviarComunicacaoProativa(envioDoJob, 1, 0),
        { enviar: async () => sucesso(undefined) },
        0,
      ),
      alertas,
      { agora: () => AGORA },
    ).execute();

    expect(rodada.ok && rodada.value.dasEnviados).toBe(0);
    expect(chamadasAoProvedor).toBe(1);
  });

  it("DAS já enviado: reenvia o PDF guardado do mês do envio, sem provedor", async () => {
    const envio = new EnvioMensagemFalsoGateway();
    chamadasAoProvedor = 0;

    const r = await montarUra(envio).execute({ clienteId: alvo.id, telefone: "5521999990000" });

    expect(r.ok).toBe(true);
    expect(chamadasAoProvedor).toBe(0);
    expect(envio.documentosEnviados).toHaveLength(1);
    const documento = envio.documentosEnviados[0];
    const baixado = await fetch("url" in documento ? documento.url : "");
    expect(baixado.status).toBe(200);
    expect(await baixado.text()).toBe(PDF);
    expect(await statusDoDas(alvo.id)).toEqual({
      das_status: "enviado",
      data_envio_das: "2026-10-05",
    });
  });
});
