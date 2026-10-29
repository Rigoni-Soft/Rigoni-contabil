/**
 * Concorrência real (duas conexões) do encerramento por silêncio contra a Mensagem do cliente
 * que chega enquanto o job espera o lock do Atendimento. Requer `npx supabase start` local.
 */
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";

import { URA_ATOR_ID } from "@/modules/atendimento/domain/services/encerramento-automatico.service";

import { exigirSupabaseLocal } from "../../../../../test-support/exigir-supabase-local";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const DATABASE_URL =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

// Antes de qualquer setup destrutivo: a suíte nunca roda contra base remota.
exigirSupabaseLocal(SUPABASE_URL, DATABASE_URL);

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const SETOR = "societario" as const;
const HORA = 3_600_000;
const usuarios: string[] = [];
const atendimentos: string[] = [];
const conexoes: Client[] = [];
let telefone = 61955597000;

async function conexao(): Promise<Client> {
  const c = new Client({ connectionString: DATABASE_URL });
  await c.connect();
  conexoes.push(c);
  return c;
}

const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

const RECEBIDA =
  "select public.registrar_mensagem_recebida($1::uuid, 'contato'::public.autor_mensagem, $2, $3, null::jsonb) as r";
const JOB = "select public.encerrar_atendimentos_por_silencio($1::timestamptz, $2::uuid) as n";

// Atendimento com dono, cujo cliente calou há 30 h (vencido para o corte de 23h50).
async function atendimentoVencido(nome: string): Promise<string> {
  const { data: u } = await admin.auth.admin.createUser({
    email: `silencio-conc-${nome}-${Date.now()}@teste.local`,
    password: "senha-de-teste-123",
    email_confirm: true,
  });
  const funcionario = u.user!.id;
  usuarios.push(funcionario);
  await admin
    .from("perfis")
    .insert({ id: funcionario, nome, email: u.user!.email, papel: "funcionario", setor: SETOR });
  telefone += 1;
  const { data, error } = await admin
    .from("atendimentos")
    .insert({
      telefone: String(telefone),
      chave_telefone: String(telefone),
      setor: SETOR,
      funcionario_id: funcionario,
      assumido_em: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  atendimentos.push(data.id);
  await admin
    .from("assuncoes_atendimento")
    .insert({ atendimento_id: data.id, funcionario_id: funcionario });
  await admin.from("mensagens").insert({
    atendimento_id: data.id,
    autor: "contato",
    texto: "oi",
    criado_em: new Date(Date.now() - 30 * HORA).toISOString(),
  });
  return data.id as string;
}

const corte = () => new Date(Date.now() - (23 * HORA + 50 * 60_000)).toISOString();

async function statusEAuditorias(id: string) {
  const { data: a } = await admin.from("atendimentos").select("status").eq("id", id).single();
  const { data: r } = await admin.from("registros_auditoria").select("acao").eq("alvo", id);
  return { status: a?.status, auditorias: r?.length ?? 0 };
}

afterAll(async () => {
  for (const c of conexoes) await c.end().catch(() => undefined);
  await admin.from("registros_auditoria").delete().in("alvo", atendimentos);
  const removidos = await admin.from("atendimentos").delete().in("id", atendimentos);
  for (const id of usuarios) await admin.auth.admin.deleteUser(id);
  if (removidos.error) throw removidos.error;
});

describe("Encerramento por silêncio × Mensagem do cliente (duas conexões)", () => {
  it("Mensagem comitada enquanto o job espera o lock mantém o Atendimento aberto e sem auditoria", async () => {
    const id = await atendimentoVencido("corrida");
    const recebimento = await conexao();
    const job = await conexao();

    // A entrada de Mensagem segura a linha, sem ter inserido ainda ...
    await recebimento.query("begin");
    await recebimento.query("select 1 from public.atendimentos where id = $1 for update", [id]);
    // ... o job vê o Atendimento vencido e espera o lock ...
    const rodando = job.query(JOB, [corte(), URA_ATOR_ID]);
    await esperar(300);
    // ... a Mensagem é aceita e confirmada; o job acorda e relê o silêncio.
    await recebimento.query(RECEBIDA, [id, "cheguei", `wamid.${id}`]);
    await recebimento.query("commit");

    expect(Number((await rodando).rows[0].n)).toBe(0);
    expect(await statusEAuditorias(id)).toEqual({ status: "em_andamento", auditorias: 0 });
  });

  it("sem Mensagem nova durante a espera, o job encerra e audita uma vez", async () => {
    const id = await atendimentoVencido("sem-corrida");
    const retentor = await conexao();
    const job = await conexao();

    await retentor.query("begin");
    await retentor.query("select 1 from public.atendimentos where id = $1 for update", [id]);
    const rodando = job.query(JOB, [corte(), URA_ATOR_ID]);
    await esperar(300);
    await retentor.query("commit");
    await rodando;
    await job.query(JOB, [corte(), URA_ATOR_ID]);

    expect(await statusEAuditorias(id)).toEqual({ status: "encerrado", auditorias: 1 });
  });
});
