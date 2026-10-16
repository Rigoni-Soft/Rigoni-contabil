/**
 * Integração infra ↔ Supabase (testes.md, seção 3): requer `npx supabase start`
 * rodando localmente. Usa service_role (docs/adr/0001) — nunca o client
 * autenticado do usuário.
 */
import { createClient } from "@supabase/supabase-js";

import { Usuario, type UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";

import { SupabaseFinalizarTrocaSenhaGateway } from "./supabase-finalizar-troca-senha.gateway";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

function clienteAdmin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function criarContaAuthDeTeste(): Promise<{ id: string; email: string }> {
  const admin = clienteAdmin();
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

describe("SupabaseFinalizarTrocaSenhaGateway (integração)", () => {
  it("finaliza a troca via service_role: perfil + exatamente 1 auditoria, idempotente", async () => {
    const admin = clienteAdmin();
    const { id } = await criarContaAuthDeTeste();
    const { error: erroInsert } = await admin.from("perfis").insert({
      id,
      nome: usuarioValido(id).nome,
      email: usuarioValido(id).email,
      papel: "funcionario",
      setor: "simples_nacional",
    });
    if (erroInsert) throw new Error(`setup inválido: ${erroInsert.message}`);

    const antes = await admin.from("perfis").select("senha_trocada_em").eq("id", id).single();
    expect(antes.data?.senha_trocada_em).toBeNull();

    const gateway = new SupabaseFinalizarTrocaSenhaGateway(admin);
    const prova = await gateway.registrarAuthAlterado(id as UsuarioId);
    expect(prova.ok).toBe(true);
    const resultado = await gateway.finalizar(id as UsuarioId);
    // Idempotente: segunda chamada não duplica auditoria nem falha.
    expect((await gateway.finalizar(id as UsuarioId)).ok).toBe(true);

    expect(resultado.ok).toBe(true);
    const depois = await admin.from("perfis").select("senha_trocada_em").eq("id", id).single();
    expect(depois.data?.senha_trocada_em).not.toBeNull();
    const auditorias = await admin.from("registros_auditoria").select("acao").eq("ator", id);
    expect(auditorias.data).toEqual([{ acao: "usuario.trocar_senha_primeiro_acesso" }]);
  });

  // Antes, `grant execute ... to authenticated` deixava qualquer sessão (inclusive
  // com senha ainda provisória) chamar a RPC direto via supabase-js, sem trocar a
  // senha de verdade no Auth. Agora só service_role executa — prova negativa de
  // que o bypass fechou.
  it("um usuário autenticado comum não consegue chamar a RPC diretamente", async () => {
    const { id, email } = await criarContaAuthDeTeste();

    const comoUsuario = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { error: erroLogin } = await comoUsuario.auth.signInWithPassword({
      email,
      password: "senha-de-teste-123",
    });
    if (erroLogin) throw new Error(`setup inválido: ${erroLogin.message}`);

    const { error } = await comoUsuario.rpc("finalizar_troca_senha", { usuario_id: id });

    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/permission denied/i);
  });
});
