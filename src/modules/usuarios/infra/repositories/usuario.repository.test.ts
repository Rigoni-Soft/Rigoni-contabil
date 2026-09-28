/**
 * Integração infra ↔ Supabase (testes.md, seção 3): requer `npx supabase start`
 * rodando localmente com as migrations e o seed aplicados. Usa os usuários de
 * `supabase/seed.sql`: Admin (administrativo), Funcionário SN (simples_nacional),
 * Funcionário Financeiro (financeiro) e Líder Contábil (contabil) — cobrindo o
 * isolamento por setor exigido pela RLS (revisão do #28).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";

import { SupabaseUsuarioRepository } from "./usuario.repository";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const ADMIN_ID = "11111111-1111-1111-1111-111111111111" as UsuarioId;
const FUNCIONARIO_SN_ID = "22222222-2222-2222-2222-222222222222" as UsuarioId;
const FUNCIONARIO_FINANCEIRO_ID = "33333333-3333-3333-3333-333333333333" as UsuarioId;
const LIDER_CONTABIL_ID = "44444444-4444-4444-4444-444444444444" as UsuarioId;
const FUNCIONARIO_FINANCEIRO_2_ID = "55555555-5555-5555-5555-555555555555" as UsuarioId;

async function clienteAutenticado(email: string, senha: string): Promise<SupabaseClient> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(`Falha ao autenticar ${email}: ${error.message}`);
  return supabase;
}

const comoAdmin = () => clienteAutenticado("admin@rigonicontabil.local", "admin123");
const comoFuncionarioSN = () =>
  clienteAutenticado("funcionario.sn@rigonicontabil.local", "func123");
const comoFuncionarioFinanceiro = () =>
  clienteAutenticado("funcionario.financeiro@rigonicontabil.local", "func123");
const comoLiderContabil = () =>
  clienteAutenticado("lider.contabil@rigonicontabil.local", "lider123");

describe("SupabaseUsuarioRepository (integração)", () => {
  it("busca o próprio perfil (RLS: perfis_select_proprio) e reconstitui o Usuario", async () => {
    const supabase = await comoAdmin();
    const repositorio = new SupabaseUsuarioRepository(supabase);

    const usuario = await repositorio.buscarPorId(ADMIN_ID);

    expect(usuario?.papel.ehAdmin()).toBe(true);
    expect(usuario?.setor.slug).toBe("administrativo");
  });

  it("devolve null para um id inexistente", async () => {
    const supabase = await comoAdmin();
    const repositorio = new SupabaseUsuarioRepository(supabase);

    const usuario = await repositorio.buscarPorId(
      "00000000-0000-0000-0000-000000000000" as UsuarioId,
    );

    expect(usuario).toBeNull();
  });

  it("devolve null (não lança) quando o Postgres rejeita a consulta, ex.: id malformado", async () => {
    const supabase = await comoAdmin();
    const repositorio = new SupabaseUsuarioRepository(supabase);

    await expect(repositorio.buscarPorId("id-nao-e-um-uuid" as UsuarioId)).resolves.toBeNull();
  });

  describe("isolamento por setor (RLS)", () => {
    it("Admin → outro setor: permitido", async () => {
      const supabase = await comoAdmin();
      const repositorio = new SupabaseUsuarioRepository(supabase);

      const usuario = await repositorio.buscarPorId(FUNCIONARIO_SN_ID);

      expect(usuario?.setor.slug).toBe("simples_nacional");
    });

    it("Funcionário → próprio setor (o próprio perfil): permitido", async () => {
      const supabase = await comoFuncionarioSN();
      const repositorio = new SupabaseUsuarioRepository(supabase);

      const usuario = await repositorio.buscarPorId(FUNCIONARIO_SN_ID);

      expect(usuario?.papel.valor).toBe("funcionario");
    });

    it("Funcionário → outro setor: negado", async () => {
      const supabase = await comoFuncionarioSN();
      const repositorio = new SupabaseUsuarioRepository(supabase);

      const usuario = await repositorio.buscarPorId(FUNCIONARIO_FINANCEIRO_ID);

      expect(usuario).toBeNull();
    });

    it("Líder → próprio setor (o próprio perfil): permitido", async () => {
      const supabase = await comoLiderContabil();
      const repositorio = new SupabaseUsuarioRepository(supabase);

      const usuario = await repositorio.buscarPorId(LIDER_CONTABIL_ID);

      expect(usuario?.papel.ehLiderSetor()).toBe(true);
    });

    it("Líder → outro setor: negado", async () => {
      const supabase = await comoLiderContabil();
      const repositorio = new SupabaseUsuarioRepository(supabase);

      const usuario = await repositorio.buscarPorId(FUNCIONARIO_SN_ID);

      expect(usuario).toBeNull();
    });

    it("Funcionário → outro Funcionário do mesmo setor: permitido (perfis_select_mesmo_setor)", async () => {
      const supabase = await comoFuncionarioFinanceiro();
      const repositorio = new SupabaseUsuarioRepository(supabase);

      const colega = await repositorio.buscarPorId(FUNCIONARIO_FINANCEIRO_2_ID);

      expect(colega?.setor.slug).toBe("financeiro");
    });
  });
});
