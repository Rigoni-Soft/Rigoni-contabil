/**
 * Integração infra ↔ Supabase (testes.md, seção 3) do job de envio da guia de parcelamento (#53):
 * leitura dos pendentes, reivindicação com auditoria da URA e alertas separados por origem.
 * Requer `npx supabase start` local com migrations aplicadas.
 */
import { createClient } from "@supabase/supabase-js";

import { URA_ATOR_ID } from "@/modules/atendimento/domain/services/inatividade.service";

import { SupabaseAlertaSetorGateway } from "./supabase-alerta-setor.gateway";
import { SupabaseClientesParaParcelamentoGateway } from "./supabase-clientes-para-parcelamento.gateway";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const clientes = new SupabaseClientesParaParcelamentoGateway(admin);
const alertasParcelamento = new SupabaseAlertaSetorGateway(admin, "parcelamento");
const alertasLembretes = new SupabaseAlertaSetorGateway(admin, "lembretes");

const clienteId = crypto.randomUUID();
const semParcelamentoId = crypto.randomUUID();
const cnpj = `8${Date.now()}`.slice(0, 14);
const sufixo = String(Date.now()).slice(-8);

beforeAll(async () => {
  const novos = await admin.from("clientes").insert([
    { id: clienteId, empresa: "Parcelamento Teste Ltda", cnpj, regime: "simples_nacional" },
    {
      id: semParcelamentoId,
      empresa: "Sem Parcelamento Ltda",
      cnpj: `9${sufixo}${sufixo}`.slice(0, 14),
      regime: "simples_nacional",
    },
  ]);
  if (novos.error) throw novos.error;
  const cadastros = await admin.from("cliente_cadastro_operacional_sn").upsert([
    {
      cliente_id: clienteId,
      forma_envio: "whatsapp",
      tem_parcelamento: true,
      parcelamento_status: "pendente",
    },
    {
      cliente_id: semParcelamentoId,
      forma_envio: "whatsapp",
      tem_parcelamento: false,
      parcelamento_status: "pendente",
    },
  ]);
  if (cadastros.error) throw cadastros.error;
});

afterAll(async () => {
  await admin.from("registros_auditoria").delete().eq("alvo", cnpj);
  await admin.from("clientes").delete().in("id", [clienteId, semParcelamentoId]);
});

describe("job de envio da guia de parcelamento (infra)", () => {
  it("lista só quem tem parcelamento e Parcelamento pendente", async () => {
    const lista = await clientes.listarPendentes();

    expect(lista.ok).toBe(true);
    const ids = lista.ok ? lista.value.map((c) => c.clienteId) : [];
    expect(ids).toContain(clienteId);
    expect(ids).not.toContain(semParcelamentoId);
  });

  it("reivindica o Parcelamento pendente e audita com a URA; a segunda vez devolve false", async () => {
    expect(await clientes.reivindicar(clienteId)).toEqual({ ok: true, value: true });

    const cadastro = await admin
      .from("cliente_cadastro_operacional_sn")
      .select("parcelamento_status")
      .eq("cliente_id", clienteId)
      .single();
    expect(cadastro.data).toEqual({ parcelamento_status: "enviado" });
    const auditoria = await admin
      .from("registros_auditoria")
      .select("ator, setor, acao, resultado")
      .eq("alvo", cnpj);
    expect(auditoria.data).toEqual([
      {
        ator: URA_ATOR_ID,
        setor: "simples_nacional",
        acao: "cliente.enviar-parcelamento-automatico",
        resultado: "sucesso",
      },
    ]);

    expect(await clientes.reivindicar(clienteId)).toEqual({ ok: true, value: false });
  });

  it("não reivindica Cliente sem parcelamento", async () => {
    expect(await clientes.reivindicar(semParcelamentoId)).toEqual({ ok: true, value: false });
  });

  it("desfaz a reivindicação: volta a pendente e registra o desfazer", async () => {
    expect(await clientes.desfazer(clienteId)).toEqual({ ok: true, value: undefined });

    const cadastro = await admin
      .from("cliente_cadastro_operacional_sn")
      .select("parcelamento_status")
      .eq("cliente_id", clienteId)
      .single();
    expect(cadastro.data).toEqual({ parcelamento_status: "pendente" });
    const auditoria = await admin
      .from("registros_auditoria")
      .select("acao")
      .eq("alvo", cnpj)
      .order("criado_em");
    expect(auditoria.data).toEqual([
      { acao: "cliente.enviar-parcelamento-automatico" },
      { acao: "cliente.desfazer-envio-parcelamento-automatico" },
    ]);
  });

  it("desfazer num Parcelamento que não está enviado não altera nem audita", async () => {
    expect(await clientes.desfazer(clienteId)).toEqual({ ok: true, value: undefined });

    const auditoria = await admin.from("registros_auditoria").select("acao").eq("alvo", cnpj);
    expect(auditoria.data).toHaveLength(2);
  });

  it("cada job resolve só os alertas da própria origem", async () => {
    const base = {
      setor: "simples_nacional",
      clienteId,
      mensagem: "x",
    } as const;
    await alertasLembretes.alertar({ ...base, tipo: "das_pendente" });
    await alertasParcelamento.alertar({ ...base, tipo: "falha_envio" });

    await alertasParcelamento.resolverNaoRenovados(new Date(Date.now() + 60_000));

    const abertos = await admin
      .from("alertas_setor")
      .select("tipo, origem")
      .eq("cliente_id", clienteId)
      .is("resolvido_em", null);
    expect(abertos.data).toEqual([{ tipo: "das_pendente", origem: "lembretes" }]);
  });

  it("o mesmo tipo de alerta do mesmo Cliente abre um alerta por origem", async () => {
    const base = { setor: "simples_nacional", clienteId, mensagem: "y" } as const;
    await alertasLembretes.alertar({ ...base, tipo: "falha_envio" });
    await alertasParcelamento.alertar({ ...base, tipo: "falha_envio" });

    const abertos = await admin
      .from("alertas_setor")
      .select("origem")
      .eq("cliente_id", clienteId)
      .eq("tipo", "falha_envio")
      .is("resolvido_em", null);
    expect(abertos.data?.map((a) => a.origem).sort()).toEqual(["lembretes", "parcelamento"]);
  });
});
