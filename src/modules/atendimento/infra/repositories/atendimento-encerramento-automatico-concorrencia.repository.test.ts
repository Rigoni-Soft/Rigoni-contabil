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

// Barreira verificável: só segue quando a sessão `pid` está de fato esperando um lock.
async function aguardarBloqueio(observador: Client, pid: number): Promise<void> {
  for (let i = 0; i < 100; i += 1) {
    const { rowCount } = await observador.query(
      "select 1 from pg_stat_activity where pid = $1 and wait_event_type = 'Lock'",
      [pid],
    );
    if (rowCount) return;
    await esperar(50);
  }
  throw new Error(`a sessão ${pid} não chegou a esperar o lock`);
}

async function pidDe(c: Client): Promise<number> {
  return (await c.query("select pg_backend_pid() as pid")).rows[0].pid;
}

const ANEXO_IMAGEM = { tipo: "imagem", nome: "foto.png", tamanho: 10, caminho: "a/foto.png" };
const TRANSFERIR =
  "select public.transferir_atendimento($1::uuid, $2::uuid, 'administrativo'::public.setor_slug, null::uuid, 'resumo', $2::uuid, $3::public.setor_slug, $3::public.setor_slug) as r";

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

async function donoDe(id: string) {
  const { data } = await admin.from("atendimentos").select("funcionario_id").eq("id", id).single();
  return data?.funcionario_id as string | null;
}

const corte = () => new Date(Date.now() - (23 * HORA + 50 * 60_000)).toISOString();

async function statusEAuditorias(id: string) {
  const { data: a } = await admin.from("atendimentos").select("status").eq("id", id).single();
  const { data: r } = await admin
    .from("registros_auditoria")
    .select("acao")
    .eq("alvo", id)
    .eq("acao", "atendimento.encerrar");
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
  // O recebimento segura a linha; o job é lançado e só se continua depois de provado que ele espera.
  async function jobEsperandoOLock(id: string) {
    const recebimento = await conexao();
    const job = await conexao();
    const observador = await conexao();
    const pidJob = await pidDe(job);

    await recebimento.query("begin");
    await recebimento.query("select 1 from public.atendimentos where id = $1 for update", [id]);
    const rodando = job.query(JOB, [corte(), URA_ATOR_ID]);
    await aguardarBloqueio(observador, pidJob);
    return { recebimento, rodando };
  }

  it.each([
    ["texto", null],
    ["imagem", ANEXO_IMAGEM],
  ] as const)(
    "%s comitado enquanto o job espera o lock mantém o Atendimento aberto e sem auditoria",
    async (_, anexo) => {
      const id = await atendimentoVencido(`corrida-${_}`);
      const { recebimento, rodando } = await jobEsperandoOLock(id);

      await recebimento.query(
        "select public.registrar_mensagem_recebida($1::uuid, 'contato'::public.autor_mensagem, $2, $3, $4::jsonb)",
        [id, "cheguei", `wamid.${id}`, anexo ? JSON.stringify(anexo) : null],
      );
      await recebimento.query("commit");

      expect(Number((await rodando).rows[0].n)).toBe(0);
      expect(await statusEAuditorias(id)).toEqual({ status: "em_andamento", auditorias: 0 });
    },
  );

  it("transferência comitada enquanto o job espera o lock: o job não encerra nem audita", async () => {
    const id = await atendimentoVencido("transferencia");
    const dono = (await donoDe(id))!;
    const { recebimento, rodando } = await jobEsperandoOLock(id);

    await recebimento.query(TRANSFERIR, [id, dono, SETOR]);
    await recebimento.query("commit");

    expect(Number((await rodando).rows[0].n)).toBe(0);
    expect(await statusEAuditorias(id)).toEqual({ status: "em_andamento", auditorias: 0 });
    expect(await donoDe(id)).toBeNull();
  });

  it("ordem inversa: o job vence a disputa e a Mensagem recebida em seguida é recusada como 'encerrada'", async () => {
    const id = await atendimentoVencido("inversa");
    const job = await conexao();
    const recebimento = await conexao();
    const observador = await conexao();
    const pidRecebimento = await pidDe(recebimento);

    await job.query("begin");
    expect(Number((await job.query(JOB, [corte(), URA_ATOR_ID])).rows[0].n)).toBe(1);
    const gravando = recebimento.query(
      "select public.registrar_mensagem_recebida($1::uuid, 'contato'::public.autor_mensagem, $2, $3, null::jsonb) as r",
      [id, "tarde demais", `wamid.${id}`],
    );
    await aguardarBloqueio(observador, pidRecebimento);
    await job.query("commit");

    expect((await gravando).rows[0].r).toBe("encerrada");
    expect(await statusEAuditorias(id)).toEqual({ status: "encerrado", auditorias: 1 });
    const { data } = await admin.from("mensagens").select("texto").eq("atendimento_id", id);
    expect(data).toEqual([{ texto: "oi" }]);
  });

  it("sem Mensagem nova durante a espera, o job encerra e audita uma vez", async () => {
    const id = await atendimentoVencido("sem-corrida");
    const { recebimento, rodando } = await jobEsperandoOLock(id);

    await recebimento.query("commit");
    await rodando;
    const job2 = await conexao();
    await job2.query(JOB, [corte(), URA_ATOR_ID]);

    expect(await statusEAuditorias(id)).toEqual({ status: "encerrado", auditorias: 1 });
  });
});
