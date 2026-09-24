/**
 * Integração infra ↔ Supabase (testes.md, seção 3): requer `npx supabase start`
 * rodando localmente com as migrations e o seed aplicados. Usa o Admin de
 * `supabase/seed.sql`. NÃO executado neste ambiente — Docker indisponível no
 * sandbox onde o ticket #28 foi implementado; roda normalmente em CI/dev com
 * Docker disponível.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";

import { SupabaseUsuarioRepository } from "./usuario.repository";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const ADMIN_SEED_ID = "11111111-1111-1111-1111-111111111111" as UsuarioId;

async function clienteAutenticadoComoAdminSeed(): Promise<SupabaseClient> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error } = await supabase.auth.signInWithPassword({
    email: "admin@rigonicontabil.local",
    password: "admin123",
  });
  if (error) throw new Error(`Falha ao autenticar o admin do seed: ${error.message}`);
  return supabase;
}

describe("SupabaseUsuarioRepository (integração)", () => {
  it("busca o próprio perfil (RLS: perfis_select_proprio) e reconstitui o Usuario", async () => {
    const supabase = await clienteAutenticadoComoAdminSeed();
    const repositorio = new SupabaseUsuarioRepository(supabase);

    const usuario = await repositorio.buscarPorId(ADMIN_SEED_ID);

    expect(usuario?.papel.ehAdmin()).toBe(true);
    expect(usuario?.setor.slug).toBe("administrativo");
  });

  it("devolve null para um id inexistente", async () => {
    const supabase = await clienteAutenticadoComoAdminSeed();
    const repositorio = new SupabaseUsuarioRepository(supabase);

    const usuario = await repositorio.buscarPorId(
      "00000000-0000-0000-0000-000000000000" as UsuarioId,
    );

    expect(usuario).toBeNull();
  });
});
