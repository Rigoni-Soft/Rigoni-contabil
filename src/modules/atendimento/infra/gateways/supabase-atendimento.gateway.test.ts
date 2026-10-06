/**
 * Integração infra ↔ Supabase (testes.md, seção 3) do Atendimento/Mensagem e do balanceamento (#44).
 * Requer `npx supabase start` local com migrations + seed aplicados.
 */
import { createClient } from "@supabase/supabase-js";

import { SupabaseAtendimentoGateway } from "./supabase-atendimento.gateway";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const gateway = new SupabaseAtendimentoGateway(admin);
const TELEFONE = "61977776666";
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
  await admin.from("atendimentos").delete().eq("telefone", TELEFONE);
  await admin.auth.admin.deleteUser(funcionarioId);
});

describe("SupabaseAtendimentoGateway", () => {
  it("abre Atendimento sem Funcionário e guarda as Mensagens em ordem", async () => {
    const r = await gateway.abrir({
      telefone: TELEFONE,
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
      .eq("atendimento_id", r.ok ? r.value.id : "")
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
      telefone: TELEFONE,
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
});
