import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";

import {
  criarClienteDeTeste,
  removerClientesDeTeste,
} from "../../../../../test-support/clientes-de-teste";
import { exigirSupabaseLocal } from "../../../../../test-support/exigir-supabase-local";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const DATABASE_URL =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

exigirSupabaseLocal(SUPABASE_URL, DATABASE_URL);

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const RECEPCAO = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const CNPJ = "70000071000170";
const TELEFONE_EMAIL = "61955590021";
const TELEFONE_NUMERO = "61955590022";
const TELEFONE_DO_CONCORRENTE = "61955590023";

const conexoes: Client[] = [];
let clienteId: string;

async function conexao(): Promise<Client> {
  const c = new Client({ connectionString: DATABASE_URL });
  await c.connect();
  conexoes.push(c);
  return c;
}

async function atendimentoDaRecepcao(telefone: string): Promise<string> {
  await admin
    .from("atendimentos")
    .update({ status: "encerrado" })
    .eq("chave_telefone", telefone)
    .eq("status", "em_andamento");
  const { data, error } = await admin
    .from("atendimentos")
    .insert({
      telefone: `55${telefone}`,
      chave_telefone: telefone,
      setor: "recepcao",
      funcionario_id: RECEPCAO,
      assumido_em: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function comoRecepcao(c: Client): Promise<void> {
  await c.query("begin");
  await c.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub: RECEPCAO, role: "authenticated" }),
  ]);
  await c.query("set local role authenticated");
}

async function esperarBloqueio(c: Client): Promise<void> {
  for (let i = 0; i < 100; i += 1) {
    const { rows } = await c.query(
      "select 1 from pg_stat_activity where wait_event_type = 'Lock' and datname = current_database()",
    );
    if (rows.length > 0) return;
    await new Promise((resolver) => setTimeout(resolver, 50));
  }
  throw new Error("A chamada concorrente não chegou a esperar o lock do índice único.");
}

beforeAll(async () => {
  await removerClientesDeTeste([CNPJ]);
  await admin
    .from("atendimentos")
    .delete()
    .in("chave_telefone", [TELEFONE_EMAIL, TELEFONE_NUMERO, TELEFONE_DO_CONCORRENTE]);
  clienteId = await criarClienteDeTeste(CNPJ, "simples_nacional");
});

afterAll(async () => {
  await Promise.all(conexoes.map((c) => c.end().catch(() => undefined)));
  await admin
    .from("atendimentos")
    .delete()
    .in("chave_telefone", [TELEFONE_EMAIL, TELEFONE_NUMERO, TELEFONE_DO_CONCORRENTE]);
  await removerClientesDeTeste([CNPJ]);
});

describe("cadastrar_contato_ura sob concorrência (duas conexões)", () => {
  it("e-mail gravado por outra chamada no meio: devolve email_em_uso, não o erro do índice", async () => {
    const atendimentoId = await atendimentoDaRecepcao(TELEFONE_EMAIL);
    const outra = await conexao();
    const recepcao = await conexao();
    await outra.query("begin");
    await outra.query(
      "insert into cliente_contatos (id, cliente_id, nome, telefone, email) values (gen_random_uuid(), $1, 'Concorrente', $2, 'concorrente@padaria-ura.teste')",
      [clienteId, TELEFONE_DO_CONCORRENTE],
    );
    await comoRecepcao(recepcao);

    const chamada = recepcao.query(
      "select public.cadastrar_contato_ura($1, $2, 'Pedro', $3) as r",
      [atendimentoId, clienteId, "concorrente@padaria-ura.teste"],
    );
    await esperarBloqueio(outra);
    await outra.query("commit");
    const { rows } = await chamada;
    await recepcao.query("rollback");

    expect(rows[0].r).toEqual({
      status: "email_em_uso",
      contato_id: expect.any(String),
      nome: "Concorrente",
    });
  });

  it("número gravado por outra chamada no meio: devolve existente, não o erro do índice", async () => {
    const atendimentoId = await atendimentoDaRecepcao(TELEFONE_NUMERO);
    const outra = await conexao();
    const recepcao = await conexao();
    await outra.query("begin");
    await outra.query(
      "insert into cliente_contatos (id, cliente_id, nome, telefone) values (gen_random_uuid(), $1, 'Quem chegou antes', $2)",
      [clienteId, TELEFONE_NUMERO],
    );
    await comoRecepcao(recepcao);

    const chamada = recepcao.query(
      "select public.cadastrar_contato_ura($1, $2, 'Pedro', null) as r",
      [atendimentoId, clienteId],
    );
    await esperarBloqueio(outra);
    await outra.query("commit");
    const { rows } = await chamada;
    await recepcao.query("rollback");

    expect(rows[0].r).toEqual({
      status: "existente",
      contato_id: expect.any(String),
      nome: "Quem chegou antes",
    });
  });
});
