/**
 * Integração infra ↔ Supabase Auth Admin API (testes.md, seção 3): requer
 * `npx supabase start` rodando localmente. Usa service_role (docs/adr/0001) —
 * nunca o client autenticado do usuário.
 */
import { createClient } from "@supabase/supabase-js";

import { SupabaseAuthAdminGateway } from "./supabase-auth-admin.gateway";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

function clienteAdmin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

describe("SupabaseAuthAdminGateway (integração)", () => {
  it("cria a conta com senha provisória de 12 caracteres", async () => {
    const gateway = new SupabaseAuthAdminGateway(clienteAdmin());
    const email = `teste-${crypto.randomUUID()}@rigonicontabil.local`;

    const resultado = await gateway.criarConta(email);

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.value.id).toEqual(expect.any(String));
      expect(resultado.value.senhaProvisoria).toHaveLength(12);
    }
  });

  it("rejeita e-mail já cadastrado", async () => {
    const gateway = new SupabaseAuthAdminGateway(clienteAdmin());
    const email = `teste-${crypto.randomUUID()}@rigonicontabil.local`;
    await gateway.criarConta(email);

    const resultado = await gateway.criarConta(email);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error.code).toBe("VALIDATION_ERROR");
  });

  // Devolutiva técnica PR #61, ponto 1: removerConta é a compensação usada
  // quando uma etapa pós-Auth falha — depois de removida, o mesmo e-mail
  // volta a estar livre pra uma nova tentativa de cadastro.
  it("remove a conta e libera o e-mail pra uma nova tentativa (compensação)", async () => {
    const gateway = new SupabaseAuthAdminGateway(clienteAdmin());
    const email = `teste-${crypto.randomUUID()}@rigonicontabil.local`;
    const criada = await gateway.criarConta(email);
    if (!criada.ok) throw new Error("setup inválido");

    const removida = await gateway.removerConta(criada.value.id);
    expect(removida.ok).toBe(true);

    const novaTentativa = await gateway.criarConta(email);
    expect(novaTentativa.ok).toBe(true);
  });
});
