/**
 * Integração infra ↔ Supabase (testes.md, seção 3) do job de envio da guia de parcelamento:
 * leitura paginada dos pendentes, reserva/conclusão com posse por token e auditoria da URA, e
 * alertas separados por origem e por Cliente avaliado. Destrutiva: só roda no Supabase local e limpa pelos IDs da própria execução. Requer `npx supabase start`.
 */
import { EntregarComunicacaoPorCanais } from "@/modules/atendimento/application/use-cases/entregar-comunicacao-por-canais.use-case";
import { EnviarComunicacaoProativa } from "@/modules/atendimento/application/use-cases/enviar-comunicacao-proativa.use-case";
import { ExecutarEnvioGuiaParcelamento } from "@/modules/atendimento/application/use-cases/executar-envio-guia-parcelamento.use-case";
import { ObterGuiaParcelamentoParaEnvio } from "@/modules/atendimento/application/use-cases/obter-guia-parcelamento-para-envio.use-case";
import { URA_ATOR_ID } from "@/modules/atendimento/domain/services/inatividade.service";
import { soDigitosNacionais } from "@/modules/atendimento/domain/services/telefone.service";
import { ok as sucesso } from "@/shared/kernel/result";

import { criarAdminLocal } from "../../../../../test-support/admin-supabase-local";
import { EnvioMensagemFalsoGateway } from "./envio-mensagem-falso.gateway";
import { SupabaseAlertaSetorGateway } from "./supabase-alerta-setor.gateway";
import { SupabaseClientesParaParcelamentoGateway } from "./supabase-clientes-para-parcelamento.gateway";

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

// O destino é validado antes de o client existir: remoto falha alto, sem tocar em dados alheios.
const admin = criarAdminLocal(SERVICE_KEY);
const clientes = new SupabaseClientesParaParcelamentoGateway(admin);
const alertasParcelamento = new SupabaseAlertaSetorGateway(admin, "parcelamento");
const alertasLembretes = new SupabaseAlertaSetorGateway(admin, "lembretes");

const sufixo = String(Date.now()).slice(-8);
const HORA_MS = 60 * 60 * 1000;

type Fixture = { id: string; cnpj: string };
const criados: Fixture[] = [];
const atendimentos: string[] = [];
let sequencia = 0;

function cnpjUnico(): string {
  sequencia += 1;
  return `8${sufixo}${String(sequencia).padStart(5, "0")}`.slice(0, 14);
}

async function ok<T>(consulta: PromiseLike<{ data: T; error: { message: string } | null }>) {
  const { data, error } = await consulta;
  if (error) throw new Error(error.message);
  // Quem lê (select) recebe o dado; insert/update sem retorno não usa o valor.
  return data as NonNullable<T>;
}

async function criarCliente(
  opcoes: { temParcelamento?: boolean; telefone?: string; empresa?: string } = {},
): Promise<Fixture> {
  const fixture = { id: crypto.randomUUID(), cnpj: cnpjUnico() };
  await ok(
    admin.from("clientes").insert({
      id: fixture.id,
      empresa: opcoes.empresa ?? "Parcelamento Teste Ltda",
      cnpj: fixture.cnpj,
      regime: "simples_nacional",
    }),
  );
  criados.push(fixture);
  await ok(
    admin.from("cliente_cadastro_operacional_sn").upsert({
      cliente_id: fixture.id,
      forma_envio: "whatsapp",
      tem_parcelamento: opcoes.temParcelamento ?? true,
      parcelamento_status: "pendente",
    }),
  );
  if (opcoes.telefone) {
    await ok(
      admin.from("cliente_contatos").insert({
        id: crypto.randomUUID(),
        cliente_id: fixture.id,
        nome: "Ângela",
        telefone: opcoes.telefone,
        padrao: true,
      }),
    );
  }
  return fixture;
}

async function statusDoParcelamento(id: string) {
  const linha = await ok(
    admin
      .from("cliente_cadastro_operacional_sn")
      .select("parcelamento_status")
      .eq("cliente_id", id)
      .single(),
  );
  return linha.parcelamento_status;
}

let pendente: Fixture;
let semParcelamento: Fixture;

beforeAll(async () => {
  pendente = await criarCliente({ telefone: `(61) 9${sufixo.slice(0, 4)}-${sufixo.slice(4)}` });
  semParcelamento = await criarCliente({
    temParcelamento: false,
    empresa: "Sem Parcelamento Ltda",
  });
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
  expect(erros).toEqual([]);
});

describe("leitura dos pendentes", () => {
  it("lista só quem tem parcelamento e Parcelamento pendente, com o telefone de envio", async () => {
    const lista = await clientes.listarPendentes();

    expect(lista.ok).toBe(true);
    const itens = lista.ok ? lista.value : [];
    const ids = itens.map((c) => c.clienteId);
    expect(ids).toContain(pendente.id);
    expect(ids).not.toContain(semParcelamento.id);
    const nacional = soDigitosNacionais(`(61) 9${sufixo.slice(0, 4)}-${sufixo.slice(4)}`);
    expect(itens.find((c) => c.clienteId === pendente.id)?.contato?.telefone).toBe(`55${nacional}`);
  });

  it("janela de 24h pela chave nacional: mensagem recente do contato escolhe o texto livre", async () => {
    const nacional = soDigitosNacionais(`(61) 9${sufixo.slice(0, 4)}-${sufixo.slice(4)}`);
    const criado = await ok(
      admin
        .from("atendimentos")
        .insert({
          telefone: `55${nacional}`,
          chave_telefone: soDigitosNacionais(`55${nacional}`),
          cliente_id: pendente.id,
          setor: "recepcao",
        })
        .select("id")
        .single(),
    );
    atendimentos.push(criado.id);
    await ok(
      admin.from("mensagens").insert({
        atendimento_id: criado.id,
        autor: "contato",
        texto: "oi",
        criado_em: new Date(Date.now() - HORA_MS).toISOString(),
      }),
    );

    const lista = await clientes.listarPendentes();
    const c = lista.ok ? lista.value.find((x) => x.clienteId === pendente.id) : undefined;

    expect(c?.ultimaMensagemDoContatoEm).toBeInstanceOf(Date);
    const envio = new EnvioMensagemFalsoGateway();
    jest.spyOn(console, "info").mockImplementation(() => undefined);
    await new EnviarComunicacaoProativa(envio).execute({
      telefone: c!.contato!.telefone,
      comunicacao: {
        tipo: "envio_guia_parcelamento",
        contato: "Ângela",
        empresa: "Teste",
        parcela: "09/2026",
        guia: { url: "https://x/g.pdf", nomeArquivo: "g.pdf" },
      },
      ultimaMensagemDoContatoEm: c!.ultimaMensagemDoContatoEm,
      agora: new Date(),
    });
    expect(envio.templatesEnviados).toHaveLength(0);
    expect(envio.enviadas).toHaveLength(1);
  });

  it("1.001 pendentes além do teto do PostgREST: todos aparecem, uma vez, em ordem de cliente_id", async () => {
    const lote: Fixture[] = [];
    for (let i = 0; i < 1001; i += 1) lote.push({ id: crypto.randomUUID(), cnpj: cnpjUnico() });
    for (let i = 0; i < lote.length; i += 500) {
      const parte = lote.slice(i, i + 500);
      await ok(
        admin.from("clientes").insert(
          parte.map((c) => ({
            id: c.id,
            empresa: "Volume Parcelamento Ltda",
            cnpj: c.cnpj,
            regime: "simples_nacional",
          })),
        ),
      );
      criados.push(...parte);
      await ok(
        admin.from("cliente_cadastro_operacional_sn").upsert(
          parte.map((c) => ({
            cliente_id: c.id,
            forma_envio: "whatsapp",
            tem_parcelamento: true,
            parcelamento_status: "pendente",
          })),
        ),
      );
    }

    const lista = await clientes.listarPendentes();

    expect(lista.ok).toBe(true);
    const ids = lista.ok ? lista.value.map((c) => c.clienteId) : [];
    expect(new Set(ids).size).toBe(ids.length);
    const nossos = new Set(lote.map((c) => c.id));
    expect(ids.filter((id) => nossos.has(id))).toHaveLength(1001);
    expect(ids).toEqual([...ids].sort());
  }, 120_000);
});

describe("reserva e conclusão do envio do Parcelamento", () => {
  it("reservar não muda o Parcelamento; a segunda reserva vigente devolve null", async () => {
    const token = await clientes.reservar(pendente.id);

    expect(token.ok && typeof token.value).toBe("string");
    expect(await statusDoParcelamento(pendente.id)).toBe("pendente");
    expect(await clientes.reservar(pendente.id)).toEqual({ ok: true, value: null });
  });

  it("não reserva Cliente sem parcelamento", async () => {
    expect(await clientes.reservar(semParcelamento.id)).toEqual({ ok: true, value: null });
  });

  it("token desconhecido não conclui nem altera o cadastro", async () => {
    expect(await clientes.concluir(pendente.id, crypto.randomUUID())).toEqual({
      ok: true,
      value: false,
    });
    expect(await statusDoParcelamento(pendente.id)).toBe("pendente");
  });

  it("concluir com o token da reserva: enviado e uma auditoria da URA; repetir não tem efeito", async () => {
    await admin.from("envios_automaticos").delete().eq("cliente_id", pendente.id);
    const reserva = await clientes.reservar(pendente.id);
    const token = reserva.ok ? reserva.value! : "";

    expect(await clientes.concluir(pendente.id, token)).toEqual({ ok: true, value: true });

    expect(await statusDoParcelamento(pendente.id)).toBe("enviado");
    const auditoria = await ok(
      admin
        .from("registros_auditoria")
        .select("ator, setor, acao, resultado")
        .eq("alvo", pendente.cnpj),
    );
    expect(auditoria).toEqual([
      {
        ator: URA_ATOR_ID,
        setor: "simples_nacional",
        acao: "cliente.enviar-parcelamento-automatico",
        resultado: "sucesso",
      },
    ]);
    expect(await clientes.concluir(pendente.id, token)).toEqual({ ok: true, value: false });
    expect(await clientes.reservar(pendente.id)).toEqual({ ok: true, value: null });
  });

  it("liberar devolve a reserva sem tocar no cadastro; token antigo não libera a de outra tentativa", async () => {
    await ok(
      admin
        .from("cliente_cadastro_operacional_sn")
        .update({ parcelamento_status: "pendente" })
        .eq("cliente_id", pendente.id),
    );
    const a = await clientes.reservar(pendente.id);
    const tokenA = a.ok ? a.value! : "";

    expect(await clientes.liberar(pendente.id, tokenA)).toEqual({ ok: true, value: undefined });
    expect(await statusDoParcelamento(pendente.id)).toBe("pendente");

    const b = await clientes.reservar(pendente.id);
    const tokenB = b.ok ? b.value! : "";
    expect(tokenB).not.toBe(tokenA);
    await clientes.liberar(pendente.id, tokenA);
    expect(await clientes.reservar(pendente.id)).toEqual({ ok: true, value: null });
    expect(await clientes.concluir(pendente.id, tokenB)).toEqual({ ok: true, value: true });
  });

  it("reserva expirada é retomada; o token antigo não sobrescreve a conclusão mais recente", async () => {
    await ok(
      admin
        .from("cliente_cadastro_operacional_sn")
        .update({ parcelamento_status: "pendente" })
        .eq("cliente_id", pendente.id),
    );
    await admin.from("envios_automaticos").delete().eq("cliente_id", pendente.id);
    const a = await clientes.reservar(pendente.id);
    const tokenA = a.ok ? a.value! : "";
    await ok(
      admin
        .from("envios_automaticos")
        .update({ reservado_em: new Date(Date.now() - HORA_MS).toISOString() })
        .eq("cliente_id", pendente.id),
    );

    const b = await clientes.reservar(pendente.id);
    const tokenB = b.ok ? b.value! : "";
    expect(tokenB).not.toBe(tokenA);
    expect(await clientes.concluir(pendente.id, tokenB)).toEqual({ ok: true, value: true });

    // A volta atrasada (e o cadastro foi recolocado em pendente por alguém): sem posse, nada muda.
    await ok(
      admin
        .from("cliente_cadastro_operacional_sn")
        .update({ parcelamento_status: "pendente" })
        .eq("cliente_id", pendente.id),
    );
    expect(await clientes.concluir(pendente.id, tokenA)).toEqual({ ok: true, value: false });
    expect(await statusDoParcelamento(pendente.id)).toBe("pendente");
  });

  it("duas reservas simultâneas: só uma recebe o token", async () => {
    await admin.from("envios_automaticos").delete().eq("cliente_id", pendente.id);

    const [x, y] = await Promise.all([
      clientes.reservar(pendente.id),
      clientes.reservar(pendente.id),
    ]);

    const tokens = [x, y].map((r) => (r.ok ? r.value : "erro"));
    expect(tokens.filter((t) => typeof t === "string" && t !== "erro")).toHaveLength(1);
    expect(tokens.filter((t) => t === null)).toHaveLength(1);
  });
});

describe("alertas por origem e por Cliente avaliado", () => {
  const base = (clienteId: string) =>
    ({ setor: "simples_nacional", clienteId, mensagem: "x" }) as const;

  it("cada job resolve só os alertas da própria origem", async () => {
    await alertasLembretes.alertar({ ...base(pendente.id), tipo: "das_pendente" });
    await alertasParcelamento.alertar({ ...base(pendente.id), tipo: "falha_envio" });

    await alertasParcelamento.resolverNaoRenovados(new Date(Date.now() + 60_000), [pendente.id]);

    const abertos = await ok(
      admin
        .from("alertas_setor")
        .select("tipo, origem")
        .eq("cliente_id", pendente.id)
        .is("resolvido_em", null),
    );
    expect(abertos).toEqual([{ tipo: "das_pendente", origem: "lembretes" }]);
  });

  it("não resolve o alerta de um Cliente que a rodada não avaliou", async () => {
    const outro = await criarCliente({ empresa: "Nao Avaliado Ltda" });
    await alertasParcelamento.alertar({ ...base(outro.id), tipo: "falha_envio" });
    await alertasParcelamento.alertar({ ...base(pendente.id), tipo: "falha_envio" });

    await alertasParcelamento.resolverNaoRenovados(new Date(Date.now() + 60_000), [pendente.id]);

    const doOutro = await ok(
      admin
        .from("alertas_setor")
        .select("tipo")
        .eq("cliente_id", outro.id)
        .is("resolvido_em", null),
    );
    expect(doOutro).toEqual([{ tipo: "falha_envio" }]);
    const doAvaliado = await ok(
      admin
        .from("alertas_setor")
        .select("tipo")
        .eq("cliente_id", pendente.id)
        .eq("origem", "parcelamento")
        .is("resolvido_em", null),
    );
    expect(doAvaliado).toEqual([]);
  });

  it("o mesmo tipo de alerta do mesmo Cliente abre um alerta por origem", async () => {
    await alertasLembretes.alertar({ ...base(pendente.id), tipo: "falha_envio" });
    await alertasParcelamento.alertar({ ...base(pendente.id), tipo: "falha_envio" });

    const abertos = await ok(
      admin
        .from("alertas_setor")
        .select("origem")
        .eq("cliente_id", pendente.id)
        .eq("tipo", "falha_envio")
        .is("resolvido_em", null),
    );
    expect(abertos.map((a) => a.origem).sort()).toEqual(["lembretes", "parcelamento"]);
  });
});

describe("rodada real com a reserva ocupada", () => {
  it("segunda rodada com a reserva vigente não resolve o alerta de falha; a retomada o resolve", async () => {
    const alvo = await criarCliente({
      telefone: `(61) 97${sufixo.slice(0, 3)}-${sufixo.slice(3, 7)}`,
      empresa: "Rodada Ocupada Ltda",
    });
    // Só o Cliente do teste participa da rodada (o banco local pode ter outros pendentes).
    const apenasOAlvo = {
      listarPendentes: async () => {
        const todos = await clientes.listarPendentes();
        return todos.ok ? sucesso(todos.value.filter((c) => c.clienteId === alvo.id)) : todos;
      },
      reservar: (id: string) => clientes.reservar(id),
      concluir: (id: string, token: string) => clientes.concluir(id, token),
      liberar: (id: string, token: string) => clientes.liberar(id, token),
    };
    let quedaNaEntrega = true;
    const envio = new EnvioMensagemFalsoGateway();
    let relogioDaRodada = new Date();
    const alertasNoRelogioDaRodada = {
      alertar: async (alerta: Parameters<typeof alertasParcelamento.alertar>[0]) => {
        const resultado = await alertasParcelamento.alertar(alerta);
        await admin
          .from("alertas_setor")
          .update({ criado_em: relogioDaRodada.toISOString() })
          .eq("cliente_id", alerta.clienteId)
          .eq("tipo", alerta.tipo)
          .eq("origem", "parcelamento")
          .is("resolvido_em", null);
        return resultado;
      },
      resolverNaoRenovados: (desde: Date, ids: string[]) =>
        alertasParcelamento.resolverNaoRenovados(desde, ids),
    };
    jest.spyOn(console, "info").mockImplementation(() => undefined);
    const montar = (agora: Date) => {
      relogioDaRodada = agora;
      return new ExecutarEnvioGuiaParcelamento(
        apenasOAlvo,
        new ObterGuiaParcelamentoParaEnvio(
          {
            buscar: async () => {
              if (quedaNaEntrega) throw new Error("processo caiu");
              return sucesso({ nomeArquivo: "p.pdf", pdfBase64: "JVBERi0=", parcela: "202609" });
            },
          },
          { publicar: async () => sucesso("https://storage.test/p.pdf") },
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
          .eq("origem", "parcelamento")
          .is("resolvido_em", null),
      );
    const diaDoJob = new Date("2026-10-22T12:00:00Z");

    // T0: a entrega cai; falha_envio aberto e a reserva fica vigente, o cadastro segue pendente.
    await montar(diaDoJob).execute();
    expect(await abertos()).toEqual([{ tipo: "falha_envio" }]);
    expect(await statusDoParcelamento(alvo.id)).toBe("pendente");

    // T0 + 2 min: a reserva vigente devolve null; nada é entregue nem concluído, e o alerta fica.
    quedaNaEntrega = false;
    await montar(new Date(diaDoJob.getTime() + 2 * 60_000)).execute();
    expect(envio.requisicoes).toHaveLength(0);
    expect(await statusDoParcelamento(alvo.id)).toBe("pendente");
    expect(await abertos()).toEqual([{ tipo: "falha_envio" }]);

    // A reserva vence: a retomada entrega, conclui e só então resolve o alerta.
    await ok(
      admin
        .from("envios_automaticos")
        .update({ reservado_em: new Date(Date.now() - 20 * 60_000).toISOString() })
        .eq("cliente_id", alvo.id),
    );
    await montar(new Date(diaDoJob.getTime() + 4 * 60_000)).execute();
    expect(envio.templatesEnviados.length + envio.enviadas.length).toBeGreaterThan(0);
    expect(await statusDoParcelamento(alvo.id)).toBe("enviado");
    expect(await abertos()).toEqual([]);
  }, 60_000);
});
