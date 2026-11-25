import { createClient } from "@supabase/supabase-js";

import type { UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import { SupabaseUsuarioRepository } from "@/modules/usuarios/infra/repositories/usuario.repository";

import { SupabaseAuthAdminGateway } from "./supabase-auth-admin.gateway";
import { SupabaseAvatarMarcaGateway } from "./supabase-avatar-marca.gateway";
import { SupabaseDesativacaoGateway } from "./supabase-desativacao.gateway";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const SENHA = "senha-de-teste-123";

function clienteAdmin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function criarPerfil(papel: "admin" | "funcionario"): Promise<{ id: string; email: string }> {
  const admin = clienteAdmin();
  const email = `teste-${crypto.randomUUID()}@rigonicontabil.local`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: SENHA,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`Falha ao criar conta de teste: ${error?.message}`);
  const { error: erroPerfil } = await admin
    .from("perfis")
    .insert({ id: data.user.id, nome: "Teste", email, papel, setor: "simples_nacional" });
  if (erroPerfil) throw new Error(`setup inválido: ${erroPerfil.message}`);
  return { id: data.user.id, email };
}

describe("desativação de usuário (integração)", () => {
  it("marca o perfil sem apagá-lo, audita 1 vez e é idempotente", async () => {
    const admin = clienteAdmin();
    const ator = await criarPerfil("admin");
    const alvo = await criarPerfil("funcionario");
    const gateway = new SupabaseDesativacaoGateway(admin);

    expect((await gateway.desativar(alvo.id as UsuarioId, ator.id as UsuarioId)).ok).toBe(true);
    expect((await gateway.desativar(alvo.id as UsuarioId, ator.id as UsuarioId)).ok).toBe(true);

    const perfil = await admin.from("perfis").select("desativado_em").eq("id", alvo.id).single();
    expect(perfil.data?.desativado_em).not.toBeNull();
    const auditorias = await admin
      .from("registros_auditoria")
      .select("acao, alvo, resultado, setor")
      .eq("ator", ator.id);
    expect(auditorias.data).toEqual([
      {
        acao: "usuario.desativar",
        alvo: alvo.email,
        resultado: "sucesso",
        setor: "simples_nacional",
      },
    ]);
  });

  it("usuário autenticado comum não chama a RPC diretamente", async () => {
    const ator = await criarPerfil("funcionario");
    const alvo = await criarPerfil("funcionario");
    const comoUsuario = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    await comoUsuario.auth.signInWithPassword({ email: ator.email, password: SENHA });

    const { error } = await comoUsuario.rpc("desativar_usuario", {
      alvo_id: alvo.id,
      ator_id: ator.id,
    });

    expect(error?.message).toMatch(/permission denied/i);
  });

  it("banirConta impede um novo login no Auth", async () => {
    const conta = await criarPerfil("funcionario");

    const banida = await new SupabaseAuthAdminGateway(clienteAdmin()).banirConta(conta.id);

    expect(banida.ok).toBe(true);
    const { error } = await createClient(SUPABASE_URL, SUPABASE_ANON_KEY).auth.signInWithPassword({
      email: conta.email,
      password: SENHA,
    });
    expect(error?.code).toBe("user_banned");
  });

  it("listarAtivos não devolve o usuário desativado", async () => {
    const admin = clienteAdmin();
    const ator = await criarPerfil("admin");
    const alvo = await criarPerfil("funcionario");
    const repositorio = new SupabaseUsuarioRepository(admin);

    const antes = await repositorio.listarAtivos();
    await new SupabaseDesativacaoGateway(admin).desativar(
      alvo.id as UsuarioId,
      ator.id as UsuarioId,
    );
    const depois = await repositorio.listarAtivos();

    expect(antes.ok && antes.value.some((u) => u.id === alvo.id)).toBe(true);
    expect(depois.ok && depois.value.some((u) => u.id === alvo.id)).toBe(false);
  });

  it("conta desativada sem ban confirmado aparece como desativação pendente e sai depois de registrar o bloqueio", async () => {
    const admin = clienteAdmin();
    const ator = await criarPerfil("admin");
    const alvo = await criarPerfil("funcionario");
    const repositorio = new SupabaseUsuarioRepository(admin);
    const desativacao = new SupabaseDesativacaoGateway(admin);
    const pendentes = async () => {
      const lista = await repositorio.listarComDesativacaoPendente();
      return lista.ok && lista.value.some((u) => u.id === alvo.id);
    };

    expect(await pendentes()).toBe(false);
    await desativacao.desativar(alvo.id as UsuarioId, ator.id as UsuarioId);
    expect(await pendentes()).toBe(true);

    expect((await desativacao.registrarBloqueio(alvo.id as UsuarioId)).ok).toBe(true);
    expect((await desativacao.registrarBloqueio(alvo.id as UsuarioId)).ok).toBe(true);
    expect(await pendentes()).toBe(false);
  });

  it("conta desativada e banida com a foto ainda gravada segue pendente até a coluna ser zerada", async () => {
    const admin = clienteAdmin();
    const ator = await criarPerfil("admin");
    const alvo = await criarPerfil("funcionario");
    const repositorio = new SupabaseUsuarioRepository(admin);
    const desativacao = new SupabaseDesativacaoGateway(admin);
    const marca = new SupabaseAvatarMarcaGateway(admin);
    const pendentes = async () => {
      const lista = await repositorio.listarComDesativacaoPendente();
      return lista.ok && lista.value.some((u) => u.id === alvo.id);
    };

    await marca.definir(alvo.id as UsuarioId, new Date());
    await desativacao.desativar(alvo.id as UsuarioId, ator.id as UsuarioId);
    await desativacao.registrarBloqueio(alvo.id as UsuarioId);
    expect(await pendentes()).toBe(true);

    await marca.definir(alvo.id as UsuarioId, null);
    expect(await pendentes()).toBe(false);
  });
});
