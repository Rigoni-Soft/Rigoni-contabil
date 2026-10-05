/**
 * Integração infra ↔ Supabase (testes.md, seção 3): requer `npx supabase start`
 * rodando localmente. Usa service_role (docs/adr/0001) — nunca o client
 * autenticado do usuário. Cada teste usa um Setor que o seed não ocupa com Líder
 * e limpa o que criou, pra não vazar Líder entre testes/execuções.
 */
import { createClient } from "@supabase/supabase-js";

import type { UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import { SupabaseDesativacaoGateway } from "@/modules/usuarios/infra/gateways/supabase-desativacao.gateway";

import { SupabaseAlteracaoPapelGateway } from "./supabase-alteracao-papel.gateway";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const SENHA = "senha-de-teste-123";
const SETOR = "recepcao";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const criados: string[] = [];

async function criarPerfil(papel: "admin" | "lider_setor" | "funcionario") {
  const email = `teste-${crypto.randomUUID()}@rigonicontabil.local`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: SENHA,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`Falha ao criar conta de teste: ${error?.message}`);
  criados.push(data.user.id);
  const { error: erroPerfil } = await admin
    .from("perfis")
    .insert({ id: data.user.id, nome: "Teste", email, papel, setor: SETOR });
  if (erroPerfil) throw new Error(`setup inválido: ${erroPerfil.message}`);
  return { id: data.user.id as UsuarioId, email };
}

const papelDe = async (id: string) =>
  (await admin.from("perfis").select("papel").eq("id", id).single()).data?.papel;

afterEach(async () => {
  // Libera o Setor: sem isso, um Líder sobrevivente quebraria os demais testes.
  await admin.from("perfis").delete().in("id", criados);
  criados.length = 0;
});

describe("alteração de papel (integração)", () => {
  const gateway = new SupabaseAlteracaoPapelGateway(admin);

  it("promove, rebaixa e audita 1 vez por troca; repetir é idempotente", async () => {
    const ator = await criarPerfil("admin");
    const alvo = await criarPerfil("funcionario");

    expect((await gateway.alterar(alvo.id, ator.id, "lider_setor")).ok).toBe(true);
    expect((await gateway.alterar(alvo.id, ator.id, "lider_setor")).ok).toBe(true);
    expect(await papelDe(alvo.id)).toBe("lider_setor");
    expect((await gateway.alterar(alvo.id, ator.id, "funcionario")).ok).toBe(true);
    expect(await papelDe(alvo.id)).toBe("funcionario");

    const { data } = await admin
      .from("registros_auditoria")
      .select("acao, alvo, resultado, setor")
      .eq("ator", ator.id)
      .order("criado_em");
    expect(data).toEqual([
      { acao: "usuario.promover", alvo: alvo.email, resultado: "sucesso", setor: SETOR },
      { acao: "usuario.rebaixar", alvo: alvo.email, resultado: "sucesso", setor: SETOR },
    ]);
  });

  it("banco recusa segundo Líder ativo no Setor, sem trocar nem auditar (corrida)", async () => {
    const ator = await criarPerfil("admin");
    await criarPerfil("lider_setor");
    const alvo = await criarPerfil("funcionario");

    const r = await gateway.alterar(alvo.id, ator.id, "lider_setor");

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("VALIDATION_ERROR");
    expect(await papelDe(alvo.id)).toBe("funcionario");
    const { data } = await admin.from("registros_auditoria").select("id").eq("ator", ator.id);
    expect(data).toEqual([]);
  });

  it("duas promoções simultâneas no mesmo Setor: só uma vence", async () => {
    const ator = await criarPerfil("admin");
    const a = await criarPerfil("funcionario");
    const b = await criarPerfil("funcionario");

    const resultados = await Promise.all([
      gateway.alterar(a.id, ator.id, "lider_setor"),
      gateway.alterar(b.id, ator.id, "lider_setor"),
    ]);

    expect(resultados.filter((r) => r.ok)).toHaveLength(1);
    const { data } = await admin
      .from("perfis")
      .select("id")
      .eq("setor", SETOR)
      .eq("papel", "lider_setor");
    expect(data).toHaveLength(1);
  });

  it("Líder desativado não bloqueia a promoção de outro", async () => {
    const ator = await criarPerfil("admin");
    const velho = await criarPerfil("lider_setor");
    const alvo = await criarPerfil("funcionario");
    await new SupabaseDesativacaoGateway(admin).desativar(velho.id, ator.id);

    expect((await gateway.alterar(alvo.id, ator.id, "lider_setor")).ok).toBe(true);
  });

  it("recusa Admin e usuário desativado como alvo", async () => {
    const ator = await criarPerfil("admin");
    const outroAdmin = await criarPerfil("admin");
    const desativado = await criarPerfil("funcionario");
    await new SupabaseDesativacaoGateway(admin).desativar(desativado.id, ator.id);

    expect((await gateway.alterar(outroAdmin.id, ator.id, "funcionario")).ok).toBe(false);
    expect((await gateway.alterar(desativado.id, ator.id, "lider_setor")).ok).toBe(false);
  });

  it("usuário autenticado comum não chama a RPC diretamente", async () => {
    const ator = await criarPerfil("funcionario");
    const alvo = await criarPerfil("funcionario");
    const comoUsuario = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    await comoUsuario.auth.signInWithPassword({ email: ator.email, password: SENHA });

    const { error } = await comoUsuario.rpc("alterar_papel_usuario", {
      alvo_id: alvo.id,
      ator_id: ator.id,
      novo_papel: "lider_setor",
    });

    expect(error?.message).toMatch(/permission denied/i);
  });
});
