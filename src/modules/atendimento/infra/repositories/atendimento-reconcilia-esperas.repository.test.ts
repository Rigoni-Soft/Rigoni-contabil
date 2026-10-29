/**
 * Migration incremental que reconcilia as esperas sem destinatário criadas antes da espera dirigida
 * (#165): a espera de antes do corte passa ao Responsável do Cliente, o mesmo ID segue e só ele assume.
 * Requer `npx supabase start` local com migrations + seed aplicados.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";

import type { SetorSlug } from "@/shared/kernel/setores";

import { exigirSupabaseLocal } from "../../../../../test-support/exigir-supabase-local";
import { SupabaseAtendimentoRepository } from "./atendimento.repository";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const DATABASE_URL =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

exigirSupabaseLocal(SUPABASE_URL, DATABASE_URL);

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const repositorio = new SupabaseAtendimentoRepository(admin);

// Setor só desta suíte: a reconciliação varre o Setor inteiro.
const SETOR = "rh" as const;
const TELEFONES = ["61955594001", "61955594002", "61955594003"];
const SQL = readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20261028180000_reconcilia_esperas_sem_destinatario.sql",
  ),
  "utf8",
);
const clienteId = crypto.randomUUID();
const CNPJ = `8${Date.now()}`.slice(0, 14);
const usuarios: string[] = [];

async function criarPerfil(nome: string, papel: "funcionario" | "lider_setor"): Promise<string> {
  const { data } = await admin.auth.admin.createUser({
    email: `reconcilia-${nome.replace(/\W/g, "")}-${Date.now()}@teste.local`,
    password: "senha-de-teste-123",
    email_confirm: true,
  });
  const id = data.user!.id;
  usuarios.push(id);
  await admin.from("perfis").insert({ id, nome, email: data.user!.email, papel, setor: SETOR });
  return id;
}

async function abrirSemDestinatario(
  telefone: string,
  cliente: string | null,
  setor: SetorSlug = SETOR,
) {
  const r = await repositorio.abrir({
    telefone,
    chave: telefone,
    clienteId: cliente,
    setor,
    mensagens: [{ autor: "contato", texto: "oi" }],
  });
  if (!r.ok) throw new Error("abertura falhou");
  // Estado de antes do corte: espera comum do Setor.
  await admin.from("atendimentos").update({ fila_funcionario_id: null }).eq("id", r.value.id);
  return r.value.id;
}

async function destinatario(id: string) {
  const { data } = await admin
    .from("atendimentos")
    .select("fila_funcionario_id, funcionario_id, fila_desde")
    .eq("id", id)
    .single();
  return data;
}

beforeAll(async () => {
  const cliente = await admin
    .from("clientes")
    .insert({ id: clienteId, empresa: "Reconcilia Ltda", cnpj: CNPJ, regime: "lucro_presumido" });
  if (cliente.error) throw cliente.error;
});

afterAll(async () => {
  await admin.from("atendimentos").delete().in("telefone", TELEFONES);
  await admin.from("clientes").delete().eq("id", clienteId);
  for (const id of usuarios) await admin.auth.admin.deleteUser(id);
});

describe("migration que reconcilia esperas sem destinatário", () => {
  it("leva a espera antiga ao Responsável sem trocar o ID nem o tempo de espera; a Recepção e o sem destino ficam como estão; só o destinatário assume", async () => {
    const outro = await criarPerfil("Outro Reconcilia", "funcionario");
    const responsavel = await criarPerfil("Responsavel Reconcilia", "funcionario");
    const semDestino = await abrirSemDestinatario(TELEFONES[0], null);
    const comResponsavel = await abrirSemDestinatario(TELEFONES[1], clienteId);
    const recepcao = await abrirSemDestinatario(TELEFONES[2], null, "recepcao");
    const atribuicao = await admin
      .from("cliente_responsaveis")
      .insert({ cliente_id: clienteId, setor: SETOR, responsavel_id: responsavel });
    if (atribuicao.error) throw atribuicao.error;
    const antes = await destinatario(comResponsavel);

    const pg = new Client({ connectionString: DATABASE_URL });
    await pg.connect();
    try {
      await pg.query(SQL);
    } finally {
      await pg.end();
    }

    expect(await destinatario(comResponsavel)).toEqual({
      ...antes,
      fila_funcionario_id: responsavel,
    });
    expect((await destinatario(semDestino))?.fila_funcionario_id).toBeNull();
    expect((await destinatario(recepcao))?.fila_funcionario_id).toBeNull();

    const porOutro = await repositorio.assumir(comResponsavel, outro);
    expect(porOutro.ok && porOutro.value).toMatchObject({ status: "inelegivel" });
    const peloResponsavel = await repositorio.assumir(comResponsavel, responsavel);
    expect(peloResponsavel.ok && peloResponsavel.value).toMatchObject({ status: "assumido" });
  });
});
