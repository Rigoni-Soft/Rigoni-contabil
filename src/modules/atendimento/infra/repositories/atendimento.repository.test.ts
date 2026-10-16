/**
 * Integração infra ↔ Supabase (testes.md, seção 3) do Atendimento/Mensagem e do balanceamento.
 * Requer `npx supabase start` local com migrations + seed aplicados.
 */
import { createClient } from "@supabase/supabase-js";

import { SupabaseAtendimentoRepository } from "./atendimento.repository";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const gateway = new SupabaseAtendimentoRepository(admin);
const TELEFONE = "61977776666";
const TELEFONE_B = "61977776667"; // índice único: um Atendimento em andamento por número
let funcionarioId: string;

beforeAll(async () => {
  const { data } = await admin.auth.admin.createUser({
    email: `atendimento-44-${Date.now()}@teste.local`,
    password: "senha-de-teste-123",
    email_confirm: true,
  });
  funcionarioId = data.user!.id;
  await admin.from("perfis").insert({
    id: funcionarioId,
    nome: "Func Teste 44",
    email: data.user!.email,
    papel: "funcionario",
    setor: "recepcao",
  });
});

afterAll(async () => {
  await admin.from("atendimentos").delete().in("telefone", [TELEFONE, TELEFONE_B]);
  await admin.auth.admin.deleteUser(funcionarioId);
});

describe("SupabaseAtendimentoRepository", () => {
  it("abre Atendimento sem Funcionário e guarda as Mensagens em ordem", async () => {
    const r = await gateway.abrir({
      telefone: TELEFONE,
      chave: TELEFONE,
      clienteId: null,
      setor: "recepcao",
      funcionarioId: null,
      mensagens: [
        { autor: "contato", texto: "oi" },
        { autor: "ura", texto: "aguarde" },
      ],
    });
    expect(r.ok).toBe(true);
    const { data } = await admin
      .from("mensagens")
      .select("autor, texto")
      .eq("atendimento_id", r.ok && r.value.status === "aberto" ? r.value.id : "")
      .order("criado_em");
    expect(data).toEqual([
      { autor: "contato", texto: "oi" },
      { autor: "ura", texto: "aguarde" },
    ]);
  });

  it("só Atendimento com Funcionário conta no mês e o ocupa", async () => {
    const antes = await gateway.funcionariosDoSetor("recepcao");
    const f = antes.ok ? antes.value.find((x) => x.id === funcionarioId) : undefined;
    expect(f).toEqual({ id: funcionarioId, atendimentosNoMes: 0, livre: true });

    await gateway.abrir({
      telefone: TELEFONE_B,
      chave: TELEFONE_B,
      clienteId: null,
      setor: "recepcao",
      funcionarioId,
      mensagens: [{ autor: "contato", texto: "oi" }],
    });
    const depois = await gateway.funcionariosDoSetor("recepcao");
    expect(depois.ok && depois.value.find((x) => x.id === funcionarioId)).toEqual({
      id: funcionarioId,
      atendimentosNoMes: 1,
      livre: false,
    });
  });

  it("recusa (conflito) atribuir a Funcionário já ocupado, sem gravar nada", async () => {
    const { count: antes } = await admin
      .from("atendimentos")
      .select("*", { count: "exact", head: true })
      .eq("telefone", TELEFONE_B + "9");
    const r = await gateway.abrir({
      telefone: TELEFONE_B + "9",
      chave: TELEFONE_B + "9",
      clienteId: null,
      setor: "recepcao",
      funcionarioId,
      mensagens: [{ autor: "contato", texto: "outro" }],
    });
    expect(r).toEqual({ ok: true, value: { status: "conflito" } });
    const { count: depois } = await admin
      .from("atendimentos")
      .select("*", { count: "exact", head: true })
      .eq("telefone", TELEFONE_B + "9");
    expect(depois).toBe(antes);
  });

  it("não abre um segundo Atendimento em andamento para o mesmo número (índice único)", async () => {
    const r = await gateway.abrir({
      telefone: TELEFONE,
      chave: TELEFONE,
      clienteId: null,
      setor: "recepcao",
      funcionarioId: null,
      mensagens: [{ autor: "contato", texto: "duplicado" }],
    });
    expect(r.ok).toBe(false);
  });

  it("anexa Mensagem ao Atendimento em andamento do número e ignora número sem Atendimento", async () => {
    expect(await gateway.anexarMensagem(TELEFONE, { autor: "contato", texto: "mais uma" })).toEqual(
      {
        ok: true,
        value: { anexada: true },
      },
    );
    expect(await gateway.anexarMensagem("00000000000", { autor: "contato", texto: "x" })).toEqual({
      ok: true,
      value: { anexada: false },
    });
  });
});

describe("SupabaseAtendimentoRepository — origem URA (#46)", () => {
  const TELEFONES = ["61977770001", "61977770002", "61977770003"];
  const clienteId = crypto.randomUUID();
  const cnpjCliente = `8${Date.now()}`.slice(0, 14);
  const cnpjNovo = `6${Date.now()}`.slice(0, 14); // sem Cliente no sistema

  beforeAll(async () => {
    const { error } = await admin.from("clientes").insert({
      id: clienteId,
      empresa: "Origem URA Ltda",
      cnpj: cnpjCliente,
      regime: "lucro_real",
    });
    if (error) throw error;
  });

  afterAll(async () => {
    await admin.from("atendimentos").delete().in("telefone", TELEFONES);
    await admin.from("clientes").delete().eq("id", clienteId);
  });

  const abrir = (telefone: string, extra: { resumo: string; cnpjInformado?: string }) =>
    gateway.abrir({
      telefone,
      chave: telefone,
      clienteId: null,
      setor: "recepcao",
      funcionarioId: null,
      mensagens: [{ autor: "contato", texto: "oi" }],
      ...extra,
    });

  const linha = async (telefone: string) =>
    (
      await admin
        .from("atendimentos")
        .select("cliente_id, resumo_ura, cnpj_informado")
        .eq("telefone", telefone)
        .single()
    ).data;

  it("CNPJ de Cliente cadastrado liga o Atendimento ao Cliente e guarda o resumo", async () => {
    const r = await abrir(TELEFONES[0], {
      resumo: "Contato não encontrado.",
      cnpjInformado: cnpjCliente,
    });
    expect(r.ok).toBe(true);
    expect(await linha(TELEFONES[0])).toEqual({
      cliente_id: clienteId,
      resumo_ura: "Contato não encontrado.",
      cnpj_informado: cnpjCliente,
    });
  });

  it("CNPJ que não existe no sistema deixa o Atendimento sem Cliente (provável cliente novo)", async () => {
    const r = await abrir(TELEFONES[1], {
      resumo: "Provável cliente novo.",
      cnpjInformado: cnpjNovo,
    });
    expect(r.ok).toBe(true);
    expect(await linha(TELEFONES[1])).toEqual({
      cliente_id: null,
      resumo_ura: "Provável cliente novo.",
      cnpj_informado: cnpjNovo,
    });
  });

  it("sem CNPJ informado guarda só o resumo", async () => {
    const r = await abrir(TELEFONES[2], { resumo: "Pediu a recepção." });
    expect(r.ok).toBe(true);
    expect(await linha(TELEFONES[2])).toEqual({
      cliente_id: null,
      resumo_ura: "Pediu a recepção.",
      cnpj_informado: null,
    });
  });
});
