/**
 * A espera sem destinatário (fora da Recepção) passa ao destinatário assim que ele surge:
 * Responsável atribuído depois ou Líder ativado depois. Mesmo ID, mensagens e tempo; a espera já dirigida,
 * o Atendimento assumido e a Recepção não mudam; só o destinatário assume, mesmo na disputa.
 * Requer `npx supabase start` local com migrations + seed aplicados.
 */
import { createClient } from "@supabase/supabase-js";

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

const SETOR = "societario" as const;
const TELEFONES = ["61955594011", "61955594012", "61955594013", "61955594014"];
const clienteId = crypto.randomUUID();
const usuarios: string[] = [];

async function criarPerfil(nome: string, papel: "funcionario" | "lider_setor"): Promise<string> {
  const { data } = await admin.auth.admin.createUser({
    email: `recupera-${nome.replace(/\W/g, "")}-${Date.now()}@teste.local`,
    password: "senha-de-teste-123",
    email_confirm: true,
  });
  const id = data.user!.id;
  usuarios.push(id);
  const r = await admin
    .from("perfis")
    .insert({ id, nome, email: data.user!.email, papel, setor: SETOR });
  if (r.error) throw r.error;
  return id;
}

async function abrir(
  telefone: string,
  cliente: string | null,
  setor: "recepcao" | typeof SETOR = SETOR,
) {
  const r = await repositorio.abrir({
    telefone,
    chave: telefone,
    clienteId: cliente,
    setor,
    mensagens: [{ autor: "contato", texto: "oi" }],
  });
  if (!r.ok) throw new Error("abertura falhou");
  return r.value.id;
}

async function estado(id: string) {
  const { data } = await admin
    .from("atendimentos")
    .select("fila_funcionario_id, funcionario_id, fila_desde")
    .eq("id", id)
    .single();
  return data;
}

beforeAll(async () => {
  // Setor sem Líder nem espera aberta: senão o destino já existiria.
  await admin.from("atendimentos").delete().eq("setor", SETOR).is("funcionario_id", null);
  const r = await admin.from("clientes").insert({
    id: clienteId,
    empresa: "Recupera Espera Ltda",
    cnpj: `7${Date.now()}`.slice(0, 14),
    regime: "lucro_presumido",
  });
  if (r.error) throw r.error;
});

afterAll(async () => {
  await admin.from("atendimentos").delete().in("telefone", TELEFONES);
  await admin.from("clientes").delete().eq("id", clienteId);
  for (const id of usuarios) await admin.auth.admin.deleteUser(id);
});

describe("espera sem destinatário que ganha destinatário depois", () => {
  it("Responsável atribuído depois recebe a mesma espera; só ele assume; trocar o Responsável não retira a espera dirigida; a Recepção segue comum", async () => {
    const responsavel = await criarPerfil("Resp Recupera", "funcionario");
    const alheio = await criarPerfil("Alheio Recupera", "funcionario");
    const espera = await abrir(TELEFONES[0], clienteId);
    const semCliente = await abrir(TELEFONES[1], null);
    const recepcao = await abrir(TELEFONES[2], null, "recepcao");
    const antes = await estado(espera);
    expect(antes?.fila_funcionario_id).toBeNull();

    const atribuicao = await admin
      .from("cliente_responsaveis")
      .insert({ cliente_id: clienteId, setor: SETOR, responsavel_id: responsavel });
    if (atribuicao.error) throw atribuicao.error;

    expect(await estado(espera)).toEqual({ ...antes, fila_funcionario_id: responsavel });
    expect((await estado(semCliente))?.fila_funcionario_id).toBeNull();
    expect((await estado(recepcao))?.fila_funcionario_id).toBeNull();

    const porAlheio = await repositorio.assumir(espera, alheio);
    expect(porAlheio.ok && porAlheio.value).toMatchObject({ status: "inelegivel" });

    const troca = await admin
      .from("cliente_responsaveis")
      .update({ responsavel_id: alheio })
      .eq("cliente_id", clienteId);
    if (troca.error) throw troca.error;
    expect((await estado(espera))?.fila_funcionario_id).toBe(responsavel);

    const assumida = await repositorio.assumir(espera, responsavel);
    expect(assumida.ok && assumida.value).toMatchObject({ status: "assumido" });
  });

  it("Líder ativado depois recebe a espera do Setor sem destino; o Atendimento assumido não muda; na disputa só o Líder assume", async () => {
    const semDestino = await abrir(TELEFONES[3], null);
    const assumidoAntes = await admin
      .from("atendimentos")
      .select("id, funcionario_id")
      .eq("telefone", TELEFONES[0])
      .single();
    expect((await estado(semDestino))?.fila_funcionario_id).toBeNull();

    const lider = await criarPerfil("Lider Recupera", "lider_setor");
    const outro = await criarPerfil("Outro Disputa", "funcionario");

    expect((await estado(semDestino))?.fila_funcionario_id).toBe(lider);
    expect((await estado(assumidoAntes.data!.id as string))?.funcionario_id).toBe(
      assumidoAntes.data!.funcionario_id,
    );

    const [a, b] = await Promise.all([
      repositorio.assumir(semDestino, lider),
      repositorio.assumir(semDestino, outro),
    ]);
    const status = [a, b].map((r) => (r.ok ? r.value.status : "erro")).sort();
    expect(status).toEqual(["assumido", "inelegivel"]);
  });
});
