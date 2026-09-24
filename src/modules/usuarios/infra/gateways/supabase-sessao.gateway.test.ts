/**
 * Integração infra ↔ Supabase Auth (testes.md, seção 3): requer `npx supabase start`
 * rodando localmente com o seed aplicado. NÃO executado neste ambiente — Docker
 * indisponível no sandbox onde o ticket #28 foi implementado.
 */
import { createClient } from "@supabase/supabase-js";

import { SupabaseSessaoGateway } from "./supabase-sessao.gateway";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

describe("SupabaseSessaoGateway (integração)", () => {
  it("autentica com credenciais válidas e expõe o id do usuário logado", async () => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const gateway = new SupabaseSessaoGateway(supabase);

    const autenticado = await gateway.autenticar("admin@rigonicontabil.local", "admin123");
    expect(autenticado.ok).toBe(true);

    const id = await gateway.usuarioAtualId();
    expect(id).toBe("11111111-1111-1111-1111-111111111111");
  });

  it("rejeita credenciais inválidas com ForbiddenError", async () => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const gateway = new SupabaseSessaoGateway(supabase);

    const autenticado = await gateway.autenticar("admin@rigonicontabil.local", "senha-errada");

    expect(autenticado.ok).toBe(false);
  });

  it("encerra a sessão e usuarioAtualId volta a ser null", async () => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const gateway = new SupabaseSessaoGateway(supabase);
    await gateway.autenticar("admin@rigonicontabil.local", "admin123");

    await gateway.encerrar();

    expect(await gateway.usuarioAtualId()).toBeNull();
  });
});
