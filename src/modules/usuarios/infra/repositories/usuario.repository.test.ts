/**
 * Integração infra ↔ Supabase (testes.md, seção 3): requer `npx supabase start`
 * rodando localmente com as migrations e o seed aplicados. Usa os usuários de
 * `supabase/seed.sql`: Admin (administrativo), Funcionário SN (simples_nacional),
 * Funcionário Financeiro (financeiro) e Líder Contábil (contabil) — cobrindo o
 * isolamento por setor exigido pela RLS (revisão do #28).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { Usuario, type UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";

import { SupabaseUsuarioRepository } from "./usuario.repository";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

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

// perfis.id referencia auth.users(id): precisa de um auth.users real (service_role,
// docs/adr/0001) antes de testar o INSERT em perfis.
async function criarContaAuthDeTeste(): Promise<{ id: string; email: string }> {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const email = `teste-${crypto.randomUUID()}@rigonicontabil.local`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: "senha-de-teste-123",
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`Falha ao criar conta de teste: ${error?.message}`);
  return { id: data.user.id, email };
}

function usuarioValido(id: string): Usuario {
  const resultado = Usuario.builder()
    .comId(id)
    .comNome("Usuário de Teste")
    .comEmail(`usuario-${id}@rigonicontabil.local`)
    .comPapel("funcionario")
    .comSetor("simples_nacional")
    .build();
  if (!resultado.ok) throw new Error("setup inválido");
  return resultado.value;
}

describe("SupabaseUsuarioRepository (integração)", () => {
  it("busca o próprio perfil (RLS: perfis_select_proprio) e reconstitui o Usuario", async () => {
    const supabase = await comoAdmin();
    const repositorio = new SupabaseUsuarioRepository(supabase);

    const resultado = await repositorio.buscarPorId(ADMIN_ID);

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.value?.papel.ehAdmin()).toBe(true);
      expect(resultado.value?.setor.slug).toBe("administrativo");
    }
  });

  it("devolve ok(null) para um id inexistente — ausência, não erro", async () => {
    const supabase = await comoAdmin();
    const repositorio = new SupabaseUsuarioRepository(supabase);

    const resultado = await repositorio.buscarPorId(
      "00000000-0000-0000-0000-000000000000" as UsuarioId,
    );

    expect(resultado).toEqual({ ok: true, value: null });
  });

  it("devolve erro (não ausência) quando o Postgres rejeita a consulta, ex.: id malformado (devolutiva #55, ponto 02)", async () => {
    const supabase = await comoAdmin();
    const repositorio = new SupabaseUsuarioRepository(supabase);

    const resultado = await repositorio.buscarPorId("id-nao-e-um-uuid" as UsuarioId);

    expect(resultado.ok).toBe(false);
  });

  describe("isolamento por setor (RLS)", () => {
    it("Admin → outro setor: permitido", async () => {
      const supabase = await comoAdmin();
      const repositorio = new SupabaseUsuarioRepository(supabase);

      const resultado = await repositorio.buscarPorId(FUNCIONARIO_SN_ID);

      expect(resultado.ok).toBe(true);
      if (resultado.ok) expect(resultado.value?.setor.slug).toBe("simples_nacional");
    });

    it("Funcionário → próprio setor (o próprio perfil): permitido", async () => {
      const supabase = await comoFuncionarioSN();
      const repositorio = new SupabaseUsuarioRepository(supabase);

      const resultado = await repositorio.buscarPorId(FUNCIONARIO_SN_ID);

      expect(resultado.ok).toBe(true);
      if (resultado.ok) expect(resultado.value?.papel.valor).toBe("funcionario");
    });

    // Consulta sem erro (resultado.ok) E ausência da linha (value === null): a
    // combinação prova bloqueio de RLS, não uma falha técnica mascarada de
    // ausência (devolutiva #55, ponto 02 — "reforçar os testes de RLS"). O
    // controle positivo de que a linha existe e é alcançável por um viewer
    // autorizado está no teste "Admin → outro setor: permitido" acima, mesmo alvo.
    it("Funcionário → outro setor: negado", async () => {
      const supabase = await comoFuncionarioSN();
      const repositorio = new SupabaseUsuarioRepository(supabase);

      const resultado = await repositorio.buscarPorId(FUNCIONARIO_FINANCEIRO_ID);

      expect(resultado).toEqual({ ok: true, value: null });
    });

    it("Líder → próprio setor (o próprio perfil): permitido", async () => {
      const supabase = await comoLiderContabil();
      const repositorio = new SupabaseUsuarioRepository(supabase);

      const resultado = await repositorio.buscarPorId(LIDER_CONTABIL_ID);

      expect(resultado.ok).toBe(true);
      if (resultado.ok) expect(resultado.value?.papel.ehLiderSetor()).toBe(true);
    });

    // Mesma lógica do teste do Funcionário acima: controle positivo do mesmo
    // alvo está em "Admin → outro setor: permitido".
    it("Líder → outro setor: negado", async () => {
      const supabase = await comoLiderContabil();
      const repositorio = new SupabaseUsuarioRepository(supabase);

      const resultado = await repositorio.buscarPorId(FUNCIONARIO_SN_ID);

      expect(resultado).toEqual({ ok: true, value: null });
    });

    it("Funcionário → outro Funcionário do mesmo setor: permitido (perfis_select_mesmo_setor)", async () => {
      const supabase = await comoFuncionarioFinanceiro();
      const repositorio = new SupabaseUsuarioRepository(supabase);

      const resultado = await repositorio.buscarPorId(FUNCIONARIO_FINANCEIRO_2_ID);

      expect(resultado.ok).toBe(true);
      if (resultado.ok) expect(resultado.value?.setor.slug).toBe("financeiro");
    });
  });

  it("Admin cria um perfil novo (RLS: perfis_insert_admin)", async () => {
    const supabase = await comoAdmin();
    const repositorio = new SupabaseUsuarioRepository(supabase);
    const { id } = await criarContaAuthDeTeste();

    const resultado = await repositorio.criar(usuarioValido(id));

    expect(resultado.ok).toBe(true);
    const salvo = await repositorio.buscarPorId(id as UsuarioId);
    expect(salvo.ok).toBe(true);
    if (salvo.ok) expect(salvo.value?.papel.valor).toBe("funcionario");
  });

  it("Funcionário não pode criar perfil (RLS)", async () => {
    const supabase = await comoFuncionarioSN();
    const repositorio = new SupabaseUsuarioRepository(supabase);
    const { id } = await criarContaAuthDeTeste();

    const resultado = await repositorio.criar(usuarioValido(id));

    expect(resultado.ok).toBe(false);
  });
});
