/**
 * Concorrência real (duas conexões) do encerramento por inatividade (#73, devolutiva da PR #83,
 * B2/B3): a Mensagem que chega e o encerramento se serializam pela linha do Atendimento, e duas
 * execuções do job não reservam o mesmo aviso. Requer `npx supabase start` local.
 */
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";

import { URA_ATOR_ID } from "@/modules/atendimento/domain/services/inatividade.service";

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

// Setor só desta suíte (encerrar mexe na Fila do Setor inteiro).
const SETOR = "tributario" as const;
const TELEFONES = [
  "61955591001",
  "61955591002",
  "61955591003",
  "61955591004",
  "61955591005",
  "61955591006",
];
const usuarios: string[] = [];
const atendimentosCriados: string[] = [];
const clientes: Client[] = [];

async function conexao(): Promise<Client> {
  const cliente = new Client({ connectionString: DATABASE_URL });
  await cliente.connect();
  clientes.push(cliente);
  return cliente;
}

const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

async function criarFuncionario(nome: string): Promise<string> {
  const { data } = await admin.auth.admin.createUser({
    email: `inatividade-concorrencia-${nome.replace(/\W/g, "")}-${Date.now()}@teste.local`,
    password: "senha-de-teste-123",
    email_confirm: true,
  });
  const id = data.user!.id;
  usuarios.push(id);
  await admin
    .from("perfis")
    .insert({ id, nome, email: data.user!.email, papel: "funcionario", setor: SETOR });
  return id;
}

// Atendimento com dono, uma Mensagem do contato e o aviso ao Funcionário já marcado (nasce entregue).
async function atendimentoEmAviso(telefone: string, nome: string) {
  const funcionario = await criarFuncionario(nome);
  const { data, error } = await admin
    .from("atendimentos")
    .insert({
      telefone,
      chave_telefone: telefone,
      setor: SETOR,
      funcionario_id: funcionario,
      assumido_em: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  atendimentosCriados.push(data.id);
  await admin
    .from("assuncoes_atendimento")
    .insert({ atendimento_id: data.id, funcionario_id: funcionario });
  await admin.from("mensagens").insert({ atendimento_id: data.id, autor: "contato", texto: "oi" });
  const marcado = await admin.rpc("marcar_aviso_inatividade", {
    p_atendimento_id: data.id,
    p_de: "funcionario",
    // Futuro: o relógio do banco (container) pode estar alguns ms à frente do desta máquina.
    p_visto_ate: new Date(Date.now() + 60_000).toISOString(),
  });
  if (marcado.error || marcado.data !== true) throw new Error("marca do aviso falhou");
  return { id: data.id as string, funcionario };
}

const ENCERRAR =
  "select public.encerrar_atendimento_por_inatividade($1::uuid, $2::uuid, $3::uuid, $4::public.setor_slug, $5) as r";

afterAll(async () => {
  for (const cliente of clientes) await cliente.end().catch(() => undefined);
  await admin.from("atendimentos").delete().in("telefone", TELEFONES);
  // Só a auditoria dos Atendimentos desta suíte: nunca a de outras (nem a de outro ator/setor).
  await admin
    .from("registros_auditoria")
    .delete()
    .eq("ator", URA_ATOR_ID)
    .eq("setor", SETOR)
    .in("alvo", atendimentosCriados);
  for (const id of usuarios) await admin.auth.admin.deleteUser(id);
});

describe("inatividade × concorrência (duas conexões)", () => {
  it("a resposta de quem estava inativo, gravada durante o encerramento, o cancela e não se perde", async () => {
    const { id, funcionario } = await atendimentoEmAviso(TELEFONES[0], "Func Concorrencia A");
    const resposta = await conexao();
    const job = await conexao();

    // A resposta segura a linha do Atendimento (como o anexo faz) ...
    await resposta.query("begin");
    await resposta.query("select 1 from public.atendimentos where id = $1 for update", [id]);
    // ... o job tenta encerrar e fica esperando ...
    const encerramento = job.query(ENCERRAR, [id, funcionario, URA_ATOR_ID, SETOR, "fim"]);
    await esperar(400);
    // ... a resposta grava e confirma: o job, ao acordar, reavalia e desiste.
    await resposta.query(
      "insert into public.mensagens (atendimento_id, autor, texto) values ($1, 'funcionario', 'voltei')",
      [id],
    );
    await resposta.query("commit");

    const resultado = await encerramento;
    expect(resultado.rows[0].r).toEqual({ status: "inexistente" });
    const { data } = await admin
      .from("atendimentos")
      .select("status, encerramento_pendente")
      .eq("id", id)
      .single();
    expect(data).toEqual({ status: "em_andamento", encerramento_pendente: false });
    const mensagens = await admin.from("mensagens").select("texto").eq("atendimento_id", id);
    expect(mensagens.data?.map((m) => m.texto).sort()).toEqual(["oi", "voltei"]);
  });

  it("a Mensagem que chega durante o encerramento não é anexada ao Atendimento encerrado", async () => {
    const { id, funcionario } = await atendimentoEmAviso(TELEFONES[1], "Func Concorrencia B");
    const encerra = await conexao();
    const chega = await conexao();

    // O encerramento decide e segura a linha, ainda sem confirmar ...
    await encerra.query("begin");
    const feito = await encerra.query(ENCERRAR, [id, funcionario, URA_ATOR_ID, SETOR, "fim"]);
    expect(feito.rows[0].r.status).toBe("encerrado");
    // ... a Mensagem do contato chega e espera a linha ...
    const anexo = chega.query(
      "select public.anexar_mensagem_atendimento($1, 'contato', 'ainda aí?') as anexada",
      [TELEFONES[1]],
    );
    await esperar(400);
    await encerra.query("commit");

    // ... e, ao acordar, vê o Atendimento encerrado: não anexa (quem chamou abre outro fluxo).
    expect((await anexo).rows[0].anexada).toBe(false);
    const mensagens = await admin.from("mensagens").select("texto").eq("atendimento_id", id);
    expect(mensagens.data?.map((m) => m.texto)).not.toContain("ainda aí?");
    // O histórico fecha com a mensagem final da URA, gravada na mesma transação.
    expect(mensagens.data?.map((m) => m.texto)).toContain("fim");
  });

  it("duas execuções do job reservam o aviso uma vez só", async () => {
    const funcionario = await criarFuncionario("Func Concorrencia C");
    const { data } = await admin
      .from("atendimentos")
      .insert({
        telefone: TELEFONES[2],
        chave_telefone: TELEFONES[2],
        setor: SETOR,
        funcionario_id: funcionario,
        assumido_em: new Date().toISOString(),
      })
      .select("id")
      .single();
    atendimentosCriados.push(data!.id);
    await admin
      .from("assuncoes_atendimento")
      .insert({ atendimento_id: data!.id, funcionario_id: funcionario });
    await admin
      .from("mensagens")
      .insert({ atendimento_id: data!.id, autor: "funcionario", texto: "bom dia" });
    const [a, b] = await Promise.all([conexao(), conexao()]);
    const MARCAR =
      "select public.marcar_aviso_inatividade($1::uuid, 'contato', now() + interval '1 minute') as marcado";

    const [primeira, segunda] = await Promise.all([
      a.query(MARCAR, [data!.id]),
      b.query(MARCAR, [data!.id]),
    ]);

    const marcados = [primeira.rows[0].marcado, segunda.rows[0].marcado];
    expect(marcados.filter(Boolean)).toHaveLength(1);
  });

  // Encerra por inatividade (nasce com a reivindicação da mensagem final) e a devolve, como o job
  // faz quando o envio falha: fica pendente e livre para ser disputada.
  async function encerradoPendente(telefone: string, nome: string): Promise<string> {
    const { id, funcionario } = await atendimentoEmAviso(telefone, nome);
    const dono = await conexao();
    const r = await dono.query(ENCERRAR, [id, funcionario, URA_ATOR_ID, SETOR, "fim"]);
    expect(r.rows[0].r.status).toBe("encerrado");
    await admin.rpc("liberar_encerramento_pendente", { p_atendimento_id: id });
    return id;
  }

  const REIVINDICAR = "select id from public.reivindicar_encerramentos_pendentes($1::int)";

  it("dois jobs disputam a mensagem final pendente: exatamente um a reivindica; vencido o lease, outro a retoma", async () => {
    const id = await encerradoPendente(TELEFONES[3], "Func Concorrencia D");
    const [a, b] = await Promise.all([conexao(), conexao()]);

    const [primeiro, segundo] = await Promise.all([
      a.query(REIVINDICAR, [100]),
      b.query(REIVINDICAR, [100]),
    ]);

    const com = [primeiro, segundo].filter((r) => r.rows.some((l) => l.id === id));
    expect(com).toHaveLength(1);
    // Reivindicada e dentro do lease: ninguém mais a vê.
    const deNovo = await a.query(REIVINDICAR, [100]);
    expect(deNovo.rows.map((l) => l.id)).not.toContain(id);
    // O job que a pegou caiu: com o lease vencido (zero), outra rodada a reivindica.
    const retomada = await b.query(
      "select id from public.reivindicar_encerramentos_pendentes(100, interval '0 seconds')",
    );
    expect(retomada.rows.map((l) => l.id)).toContain(id);
  });

  it("backlog maior que o lote é drenado em lotes, sem truncar nem repetir", async () => {
    const ids = [
      await encerradoPendente(TELEFONES[4], "Func Concorrencia E"),
      await encerradoPendente(TELEFONES[5], "Func Concorrencia F"),
    ];
    const cliente = await conexao();

    const vistos: string[] = [];
    for (;;) {
      const lote = await cliente.query(REIVINDICAR, [1]);
      expect(lote.rows.length).toBeLessThanOrEqual(1);
      if (lote.rows.length === 0) break;
      vistos.push(lote.rows[0].id);
    }

    for (const id of ids) expect(vistos.filter((v) => v === id)).toHaveLength(1);
  });
});
