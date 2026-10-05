/**
 * Integração infra ↔ Supabase (testes.md, seção 3) do cadastro de contato novo (#43).
 * Requer `npx supabase start` local com migrations + seed aplicados.
 */
import { createClient } from "@supabase/supabase-js";

import { SupabaseCadastroContatoGateway } from "./supabase-cadastro-contato.gateway";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const gateway = new SupabaseCadastroContatoGateway(admin);

const clienteId = crypto.randomUUID();
const cnpj = `7${Date.now()}`.slice(0, 14);

beforeAll(async () => {
  const r = await admin
    .from("clientes")
    .insert({ id: clienteId, empresa: "Cadastro Teste Ltda", cnpj, regime: "simples_nacional" });
  if (r.error) throw r.error;
});

afterAll(async () => {
  await admin.from("clientes").delete().eq("id", clienteId);
});

describe("SupabaseCadastroContatoGateway", () => {
  it("CNPJ inexistente retorna null", async () => {
    expect(await gateway.buscarCliente("00000000000000")).toEqual({ ok: true, value: null });
  });

  it("primeiro contato vira padrão; o seguinte entra como outro contato", async () => {
    expect(await gateway.buscarCliente(cnpj)).toEqual({
      ok: true,
      value: { clienteId, empresa: "Cadastro Teste Ltda", temPadrao: false },
    });

    const primeiro = await gateway.cadastrar({ clienteId, nome: "Bia", telefone: "61988880001" });
    expect(primeiro).toEqual({ ok: true, value: { empresa: "Cadastro Teste Ltda", padrao: true } });

    expect(await gateway.buscarCliente(cnpj)).toMatchObject({ value: { temPadrao: true } });

    const segundo = await gateway.cadastrar({ clienteId, nome: "Caio", telefone: "61988880002" });
    expect(segundo).toEqual({ ok: true, value: { empresa: "Cadastro Teste Ltda", padrao: false } });
  });

  it("Cliente inexistente é erro", async () => {
    const r = await gateway.cadastrar({
      clienteId: crypto.randomUUID(),
      nome: "X",
      telefone: "61988880003",
    });
    expect(r.ok).toBe(false);
  });
});
