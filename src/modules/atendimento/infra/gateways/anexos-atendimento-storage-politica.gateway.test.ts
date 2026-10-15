/**
 * Matriz de autorização do bucket privado `anexos-atendimento` com sessões reais (revalidação 1 da
 * PR #85, R85-04): só quem pode agir no Atendimento em andamento grava na pasta dele; ninguém lê
 * pelo cliente (o arquivo só sai por link temporário do servidor). A policy não foi ampliada para o
 * teste passar. Requer `npx supabase start` local.
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

const BUCKET = "anexos-atendimento";
const SENHA = "senha-de-teste-123";
const SETOR = "societario" as const;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const usuarios: string[] = [];
const objetos: string[] = [];
let atendimentoId = "";

type Papel = "funcionario" | "lider_setor" | "admin";

async function criarUsuario(
  nome: string,
  papel: Papel,
  setor: string,
  desativado = false,
): Promise<{ id: string; email: string }> {
  const email = `storage-${nome.replace(/\W/g, "")}-${Date.now()}@teste.local`;
  const { data } = await admin.auth.admin.createUser({
    email,
    password: SENHA,
    email_confirm: true,
  });
  const id = data.user!.id;
  usuarios.push(id);
  const { error } = await admin.from("perfis").insert({
    id,
    nome,
    email,
    papel,
    setor,
    desativado_em: desativado ? new Date().toISOString() : null,
  });
  if (error) throw error;
  return { id, email };
}

async function sessao(email: string): Promise<SupabaseClient> {
  const cliente = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { error } = await cliente.auth.signInWithPassword({ email, password: SENHA });
  if (error) throw error;
  return cliente;
}

const pdf = () => new Blob([Buffer.from("%PDF-1.4 teste")], { type: "application/pdf" });

async function tentarGravar(cliente: SupabaseClient, pasta = atendimentoId) {
  const caminho = `${pasta}/u-${Date.now()}-${Math.random().toString(36).slice(2)}/arquivo.pdf`;
  const { error } = await cliente.storage.from(BUCKET).upload(caminho, pdf(), {
    contentType: "application/pdf",
  });
  if (!error) objetos.push(caminho);
  return { error, caminho };
}

const sessoes: Record<string, SupabaseClient> = {};

beforeAll(async () => {
  const dono = await criarUsuario("Dono", "funcionario", SETOR);
  const lider = await criarUsuario("Lider", "lider_setor", SETOR);
  const liderOutro = await criarUsuario("Lider outro setor", "lider_setor", "rh");
  const outro = await criarUsuario("Outro funcionario", "funcionario", SETOR);
  const adm = await criarUsuario("Admin", "admin", "administrativo");
  const desativado = await criarUsuario("Lider desativado", "lider_setor", SETOR, true);

  const telefone = `5561${Date.now()}`.slice(0, 13);
  const { data, error } = await admin
    .from("atendimentos")
    .insert({
      telefone,
      chave_telefone: telefone,
      setor: SETOR,
      funcionario_id: dono.id,
      assumido_em: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  atendimentoId = data.id;

  sessoes.dono = await sessao(dono.email);
  sessoes.lider = await sessao(lider.email);
  sessoes.liderOutro = await sessao(liderOutro.email);
  sessoes.outro = await sessao(outro.email);
  sessoes.admin = await sessao(adm.email);
  sessoes.desativado = await sessao(desativado.email);
  sessoes.semSessao = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
});

afterAll(async () => {
  if (objetos.length) await admin.storage.from(BUCKET).remove(objetos);
  if (atendimentoId) await admin.from("atendimentos").delete().eq("id", atendimentoId);
  for (const id of usuarios) await admin.auth.admin.deleteUser(id);
});

describe("bucket anexos-atendimento: gravação por papel (Atendimento em andamento)", () => {
  it.each(["dono", "lider", "admin"] as const)("%s grava na pasta do Atendimento", async (quem) => {
    const { error } = await tentarGravar(sessoes[quem]);
    expect(error).toBeNull();
  });

  it.each(["outro", "liderOutro", "desativado", "semSessao"] as const)(
    "%s não grava na pasta do Atendimento",
    async (quem) => {
      const { error } = await tentarGravar(sessoes[quem]);
      expect(error).not.toBeNull();
    },
  );

  it("nem o dono grava em pasta de Atendimento inexistente ou de outro Atendimento", async () => {
    const inexistente = await tentarGravar(sessoes.dono, "00000000-0000-4000-8000-000000000000");
    expect(inexistente.error).not.toBeNull();
    const semPasta = await tentarGravar(sessoes.dono, "fora-do-padrao");
    expect(semPasta.error).not.toBeNull();
  });

  it("Atendimento encerrado: ninguém grava, nem o dono", async () => {
    await admin.from("atendimentos").update({ status: "encerrado" }).eq("id", atendimentoId);
    try {
      const { error } = await tentarGravar(sessoes.dono);
      expect(error).not.toBeNull();
    } finally {
      await admin.from("atendimentos").update({ status: "em_andamento" }).eq("id", atendimentoId);
    }
  });
});

describe("bucket anexos-atendimento: leitura não existe para o cliente", () => {
  it.each(["dono", "lider", "admin", "outro", "semSessao"] as const)(
    "%s não baixa nem lista (só link temporário do servidor)",
    async (quem) => {
      const gravado = await tentarGravar(sessoes.admin);
      expect(gravado.error).toBeNull();

      const baixado = await sessoes[quem].storage.from(BUCKET).download(gravado.caminho);
      expect(baixado.error).not.toBeNull();

      const listado = await sessoes[quem].storage.from(BUCKET).list(atendimentoId);
      expect(listado.data ?? []).toEqual([]);
    },
  );

  it("o bucket é privado e não é um bucket público", async () => {
    const { data } = await admin.storage.getBucket(BUCKET);
    expect(data?.public).toBe(false);
  });
});
