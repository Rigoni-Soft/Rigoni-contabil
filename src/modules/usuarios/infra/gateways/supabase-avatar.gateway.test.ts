/**
 * Integração infra ↔ Supabase (testes.md, seção 3) dos gateways do avatar: o objeto no bucket privado
 * `avatares` e a coluna `perfis.avatar_atualizado_em`, ambos gravados só com service_role (ADR 0012).
 * Requer `npx supabase start` local com migrations aplicadas.
 */
import { createClient } from "@supabase/supabase-js";

import type { SessaoPort } from "@/modules/usuarios/application/ports/out/sessao.provider";
import type { UsuarioRepository } from "@/modules/usuarios/application/ports/out/usuario.repository";
import { ObterAvatar } from "@/modules/usuarios/application/use-cases/obter-avatar.use-case";
import type { UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import { ok } from "@/shared/kernel/result";

import { exigirSupabaseLocal } from "../../../../../test-support/exigir-supabase-local";
import { usuario } from "../../../../../test-support/montar-avatar";
import { SupabaseAvatarArmazenamentoGateway } from "./supabase-avatar-armazenamento.gateway";
import { SupabaseAvatarMarcaGateway } from "./supabase-avatar-marca.gateway";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const DATABASE_URL =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

exigirSupabaseLocal(SUPABASE_URL, DATABASE_URL);

const servico = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const criados: string[] = [];

async function criarUsuario(): Promise<UsuarioId> {
  const email = `avatar-${crypto.randomUUID()}@rigonicontabil.local`;
  const { data, error } = await servico.auth.admin.createUser({
    email,
    password: "senha-de-teste-123",
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`setup inválido: ${error?.message}`);
  const { error: erroPerfil } = await servico
    .from("perfis")
    .insert({ id: data.user.id, nome: "Teste", email, papel: "funcionario", setor: "contabil" });
  if (erroPerfil) throw new Error(`setup inválido: ${erroPerfil.message}`);
  criados.push(data.user.id);
  return data.user.id as UsuarioId;
}

afterAll(async () => {
  await servico.storage.from("avatares").remove(criados);
  for (const id of criados) {
    await servico.from("perfis").delete().eq("id", id);
    await servico.auth.admin.deleteUser(id);
  }
});

describe("avatar (integração)", () => {
  it("grava, lê, sobrescreve e apaga o objeto; apagar o que não existe é sucesso", async () => {
    const id = await criarUsuario();
    const gateway = new SupabaseAvatarArmazenamentoGateway(servico);

    const ausente = await gateway.ler(id);
    expect(ausente.ok && ausente.value).toBeNull();

    expect((await gateway.gravar(id, new Uint8Array([1, 2, 3]))).ok).toBe(true);
    const primeira = await gateway.ler(id);
    expect(primeira.ok && [...(primeira.value ?? [])]).toEqual([1, 2, 3]);

    expect((await gateway.gravar(id, new Uint8Array([9, 8]))).ok).toBe(true);
    const segunda = await gateway.ler(id);
    expect(segunda.ok && [...(segunda.value ?? [])]).toEqual([9, 8]);

    expect((await gateway.apagar(id)).ok).toBe(true);
    expect((await gateway.apagar(id)).ok).toBe(true);
    const depois = await gateway.ler(id);
    expect(depois.ok && depois.value).toBeNull();
  });

  it("a sessão de cada usuário recebe só a própria foto (ObterAvatar com o Storage real)", async () => {
    const idA = await criarUsuario();
    const idB = await criarUsuario();
    const armazenamento = new SupabaseAvatarArmazenamentoGateway(servico);
    await armazenamento.gravar(idA, new Uint8Array([1, 1, 1]));
    await armazenamento.gravar(idB, new Uint8Array([2, 2]));
    const perfis = [
      usuario(idA, "funcionario", { avatar: "2026-11-18T10:00:00Z" }),
      usuario(idB, "funcionario", { avatar: "2026-11-18T10:00:00Z" }),
    ];
    const usuarios = {
      buscarPorId: async (id: UsuarioId) => ok(perfis.find((p) => p.id === id) ?? null),
    } as unknown as UsuarioRepository;
    const obterComo = (atorId: string) =>
      new ObterAvatar(
        { usuarioAtualId: async () => atorId } as unknown as SessaoPort,
        usuarios,
        armazenamento,
      ).execute();

    const comoA = await obterComo(idA);
    const comoB = await obterComo(idB);

    expect(comoA.ok && [...comoA.value]).toEqual([1, 1, 1]);
    expect(comoB.ok && [...comoB.value]).toEqual([2, 2]);
  });

  it("grava e zera a marca da foto no perfil", async () => {
    const id = await criarUsuario();
    const gateway = new SupabaseAvatarMarcaGateway(servico);
    const lerMarca = async () =>
      (await servico.from("perfis").select("avatar_atualizado_em").eq("id", id).single()).data
        ?.avatar_atualizado_em;

    expect((await gateway.definir(id, new Date("2026-11-18T10:00:00Z"))).ok).toBe(true);
    expect(new Date((await lerMarca()) as string).toISOString()).toBe("2026-11-18T10:00:00.000Z");

    expect((await gateway.definir(id, null)).ok).toBe(true);
    expect(await lerMarca()).toBeNull();
  });
});
