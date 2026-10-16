/**
 * Integração infra ↔ Supabase (testes.md, seção 3) da leitura do CNPJ do Cliente.
 * Requer `npx supabase start` local com migrations + seed aplicados.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { NotFoundError } from "@/shared/errors/not-found.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";

import { SupabaseClienteCnpjGateway } from "./supabase-cliente-cnpj.gateway";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const gateway = new SupabaseClienteCnpjGateway(admin);

const clienteId = crypto.randomUUID();
const cnpj = `8${Date.now()}`.slice(0, 14);

beforeAll(async () => {
  const cliente = await admin
    .from("clientes")
    .insert({ id: clienteId, empresa: "CNPJ Teste Ltda", cnpj, regime: "simples_nacional" });
  if (cliente.error) throw cliente.error;
});

afterAll(async () => {
  await admin.from("clientes").delete().eq("id", clienteId);
});

describe("SupabaseClienteCnpjGateway", () => {
  it("devolve o CNPJ e o Regime do cadastro do Cliente", async () => {
    expect(await gateway.cadastroFiscalDoCliente(clienteId)).toEqual({
      ok: true,
      value: { cnpj, regime: "simples_nacional" },
    });
  });

  it("Cliente inexistente é NotFoundError", async () => {
    const r = await gateway.cadastroFiscalDoCliente(crypto.randomUUID());
    expect(r).toEqual({ ok: false, error: expect.any(NotFoundError) });
  });

  it("falha do banco vira ServicoExternoError", async () => {
    const fake = {
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: "x" } }) }),
        }),
      }),
    } as unknown as SupabaseClient;
    const r = await new SupabaseClienteCnpjGateway(fake).cadastroFiscalDoCliente(clienteId);
    expect(r).toEqual({ ok: false, error: expect.any(ServicoExternoError) });
  });
});
