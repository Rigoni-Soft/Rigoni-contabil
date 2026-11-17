/**
 * Bucket privado `avatares` e coluna `perfis.avatar_atualizado_em` (ADR 0012, ADR 0008): o bucket aceita só
 * `image/webp` de até 256 KB; nenhuma sessão de usuário escreve no bucket nem na coluna; o servidor
 * (service role) escreve nos dois. Requer `npx supabase start` local com migrations e seed aplicados.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { exigirSupabaseLocal } from "../../../../../test-support/exigir-supabase-local";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const DATABASE_URL =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

exigirSupabaseLocal(SUPABASE_URL, DATABASE_URL);

const BUCKET = "avatares";
const SENHA = "senha-de-teste-123";
const ADMIN_ID = "11111111-1111-1111-1111-111111111111";
const FUNCIONARIO_SN_ID = "22222222-2222-2222-2222-222222222222";

const servico = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const usuariosCriados: string[] = [];
const objetos: string[] = [];

async function sessao(email: string, senha: string): Promise<SupabaseClient> {
  const cliente = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { error } = await cliente.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(`Falha ao autenticar ${email}: ${error.message}`);
  return cliente;
}

// WebP mínimo: o bucket confere o tipo declarado no envio, não os bytes.
const webp = (bytes: number) => Buffer.alloc(bytes, 1);

async function enviarComoServidor(nome: string, conteudo: Buffer, contentType: string) {
  objetos.push(nome);
  return servico.storage.from(BUCKET).upload(nome, conteudo, { contentType, upsert: true });
}

async function avatarDe(id: string) {
  const { data } = await servico
    .from("perfis")
    .select("avatar_atualizado_em")
    .eq("id", id)
    .single();
  return data?.avatar_atualizado_em ?? null;
}

afterAll(async () => {
  if (objetos.length > 0) await servico.storage.from(BUCKET).remove(objetos);
  for (const id of usuariosCriados) {
    await servico.from("perfis").delete().eq("id", id);
    await servico.auth.admin.deleteUser(id);
  }
});

describe("bucket avatares", () => {
  it("é privado, com limite de 256 KB e só image/webp", async () => {
    const { data, error } = await servico.storage.getBucket(BUCKET);

    expect(error).toBeNull();
    expect(data).toMatchObject({
      public: false,
      file_size_limit: 262144,
      allowed_mime_types: ["image/webp"],
    });
  });

  it("o servidor grava um WebP de até 256 KB", async () => {
    const r = await enviarComoServidor(crypto.randomUUID(), webp(262144), "image/webp");

    expect(r.error).toBeNull();
  });

  it.each([
    ["JPEG", "image/jpeg"],
    ["PNG", "image/png"],
    ["GIF", "image/gif"],
    ["SVG", "image/svg+xml"],
  ])("recusa %s mesmo para o servidor", async (_nome, tipo) => {
    const r = await enviarComoServidor(crypto.randomUUID(), webp(1024), tipo);

    expect(r.error).not.toBeNull();
  });

  it("recusa mais de 256 KB mesmo para o servidor", async () => {
    const r = await enviarComoServidor(crypto.randomUUID(), webp(262145), "image/webp");

    expect(r.error).not.toBeNull();
  });

  it("nenhuma sessão de usuário escreve, lê ou lista o bucket", async () => {
    const dono = await enviarComoServidor(FUNCIONARIO_SN_ID, webp(1024), "image/webp");
    expect(dono.error).toBeNull();

    for (const [email, senha, id] of [
      ["funcionario.sn@rigonicontabil.local", "func123", FUNCIONARIO_SN_ID],
      ["admin@rigonicontabil.local", "admin123", ADMIN_ID],
    ] as const) {
      const cliente = await sessao(email, senha);
      const envio = await cliente.storage.from(BUCKET).upload(id, webp(1024), {
        contentType: "image/webp",
        upsert: true,
      });
      const proprio = await cliente.storage.from(BUCKET).download(FUNCIONARIO_SN_ID);
      const lista = await cliente.storage.from(BUCKET).list();
      const remocao = await cliente.storage.from(BUCKET).remove([FUNCIONARIO_SN_ID]);

      expect(envio.error).not.toBeNull();
      expect(proprio.error).not.toBeNull();
      expect(lista.data ?? []).toEqual([]);
      expect(remocao.data ?? []).toEqual([]);
    }

    const aindaLa = await servico.storage.from(BUCKET).download(FUNCIONARIO_SN_ID);
    expect(aindaLa.error).toBeNull();
  });

  it("o anon não escreve nem lê", async () => {
    const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });

    const envio = await anon.storage.from(BUCKET).upload(crypto.randomUUID(), webp(1024), {
      contentType: "image/webp",
    });
    const leitura = await anon.storage.from(BUCKET).download(FUNCIONARIO_SN_ID);

    expect(envio.error).not.toBeNull();
    expect(leitura.error).not.toBeNull();
  });
});

describe("perfis.avatar_atualizado_em", () => {
  it("começa nula (sem foto) para os usuários existentes", async () => {
    expect(await avatarDe(FUNCIONARIO_SN_ID)).toBeNull();
  });

  it("o dono lê a própria coluna, mas nenhuma sessão a altera", async () => {
    const cliente = await sessao("funcionario.sn@rigonicontabil.local", "func123");

    const leitura = await cliente
      .from("perfis")
      .select("avatar_atualizado_em")
      .eq("id", FUNCIONARIO_SN_ID)
      .single();
    await cliente
      .from("perfis")
      .update({ avatar_atualizado_em: new Date().toISOString() })
      .eq("id", FUNCIONARIO_SN_ID);

    expect(leitura.error).toBeNull();
    expect(leitura.data?.avatar_atualizado_em).toBeNull();
    expect(await avatarDe(FUNCIONARIO_SN_ID)).toBeNull();
  });

  it("nem o Admin altera a coluna de outro usuário", async () => {
    const admin = await sessao("admin@rigonicontabil.local", "admin123");

    await admin
      .from("perfis")
      .update({ avatar_atualizado_em: new Date().toISOString() })
      .eq("id", FUNCIONARIO_SN_ID);

    expect(await avatarDe(FUNCIONARIO_SN_ID)).toBeNull();
  });

  it("nem o Admin cria um perfil já com a coluna preenchida", async () => {
    const email = `avatar-${Date.now()}@teste.local`;
    const { data } = await servico.auth.admin.createUser({
      email,
      password: SENHA,
      email_confirm: true,
    });
    const id = data.user!.id;
    usuariosCriados.push(id);
    const admin = await sessao("admin@rigonicontabil.local", "admin123");

    const r = await admin.from("perfis").insert({
      id,
      nome: "Teste avatar",
      email,
      papel: "funcionario",
      setor: "simples_nacional",
      avatar_atualizado_em: new Date().toISOString(),
    });

    expect(r.error?.code).toBe("23514");
  });

  it("o servidor (service role) grava e zera a coluna", async () => {
    const agora = new Date().toISOString();

    const grava = await servico
      .from("perfis")
      .update({ avatar_atualizado_em: agora })
      .eq("id", FUNCIONARIO_SN_ID);
    expect(grava.error).toBeNull();
    expect(await avatarDe(FUNCIONARIO_SN_ID)).not.toBeNull();

    const zera = await servico
      .from("perfis")
      .update({ avatar_atualizado_em: null })
      .eq("id", FUNCIONARIO_SN_ID);
    expect(zera.error).toBeNull();
    expect(await avatarDe(FUNCIONARIO_SN_ID)).toBeNull();
  });
});
