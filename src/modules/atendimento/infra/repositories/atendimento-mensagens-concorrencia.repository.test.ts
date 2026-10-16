/**
 * Concorrência real (duas conexões) das Mensagens gravadas por `registrar_mensagem_recebida` e
 * `registrar_mensagem_do_funcionario` contra o fechamento, a transferência e a desativação.
 * Quem escreve entra sob o lock da linha do Atendimento e
 * reavalia o status e a autoridade ali. Requer `npx supabase start` local.
 */
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";

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
const usuarios: string[] = [];
const atendimentos: string[] = [];
const conexoes: Client[] = [];
let telefone = 61955596000;

async function conexao(): Promise<Client> {
  const c = new Client({ connectionString: DATABASE_URL });
  await c.connect();
  conexoes.push(c);
  return c;
}

const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

async function criarFuncionario(
  nome: string,
  papel: "funcionario" | "lider_setor" | "admin" = "funcionario",
  setor: string = SETOR,
): Promise<string> {
  const { data } = await admin.auth.admin.createUser({
    email: `msg-concorrencia-${nome.replace(/\W/g, "")}-${Date.now()}@teste.local`,
    password: "senha-de-teste-123",
    email_confirm: true,
  });
  const id = data.user!.id;
  usuarios.push(id);
  await admin.from("perfis").insert({ id, nome, email: data.user!.email, papel, setor });
  return id;
}

// Atendimento em andamento com dono e uma Mensagem do contato.
async function atendimentoComDono(nome: string) {
  const funcionario = await criarFuncionario(nome);
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
  await admin.from("mensagens").insert({ atendimento_id: data.id, autor: "contato", texto: "oi" });
  return { id: data.id as string, funcionario };
}

const RECEBIDA =
  "select public.registrar_mensagem_recebida($1::uuid, 'contato'::public.autor_mensagem, $2, $3, $4::jsonb) as r";
const DO_FUNCIONARIO =
  "select public.registrar_mensagem_do_funcionario($1::uuid, $2::uuid, $3, $4::jsonb) as r";

const ANEXOS = {
  imagem: { tipo: "imagem", nome: "foto.png", tamanho: 10, caminho: "a/foto.png" },
  documento: { tipo: "documento", nome: "balanco.pdf", tamanho: 10, caminho: "a/balanco.pdf" },
  audio: { tipo: "audio", nome: "voz.ogg", tamanho: 10, caminho: "a/voz.ogg" },
} as const;

async function mensagensDe(id: string) {
  const { data } = await admin
    .from("mensagens")
    .select("autor, texto, anexo_tipo")
    .eq("atendimento_id", id)
    .order("criado_em");
  return data ?? [];
}

afterAll(async () => {
  for (const c of conexoes) await c.end().catch(() => undefined);
  const removidos = await admin.from("atendimentos").delete().in("id", atendimentos);
  for (const id of usuarios) await admin.auth.admin.deleteUser(id);
  if (removidos.error) throw removidos.error;
});

describe("Mensagem recebida × fechamento (duas conexões)", () => {
  it.each([
    ["texto", null],
    ["imagem", ANEXOS.imagem],
    ["documento", ANEXOS.documento],
    ["audio", ANEXOS.audio],
  ] as const)(
    "%s: o fechamento ganha, nada é gravado e o veredito é 'encerrada'",
    async (_, anexo) => {
      const { id } = await atendimentoComDono(`Recebida ${_}`);
      const fechamento = await conexao();
      const recebimento = await conexao();

      // O fechamento segura a linha do Atendimento ...
      await fechamento.query("begin");
      await fechamento.query("select 1 from public.atendimentos where id = $1 for update", [id]);
      // ... a Mensagem chega e espera ...
      const gravando = recebimento.query(RECEBIDA, [
        id,
        "depois do fechamento",
        `wamid.${id}.${_}`,
        anexo ? JSON.stringify(anexo) : null,
      ]);
      await esperar(300);
      // ... o fechamento confirma: a Mensagem, ao acordar, reavalia o status.
      await fechamento.query("update public.atendimentos set status = 'encerrado' where id = $1", [
        id,
      ]);
      await fechamento.query("commit");

      expect((await gravando).rows[0].r).toBe("encerrada");
      expect(await mensagensDe(id)).toEqual([{ autor: "contato", texto: "oi", anexo_tipo: null }]);
    },
  );

  it("a Mensagem ganha: entra, e o fechamento que esperava segue depois", async () => {
    const { id } = await atendimentoComDono("Recebida ganha");
    const recebimento = await conexao();
    const fechamento = await conexao();

    await recebimento.query("begin");
    const gravada = await recebimento.query(RECEBIDA, [
      id,
      "antes do fechamento",
      `wamid.${id}`,
      JSON.stringify(ANEXOS.audio),
    ]);
    expect(gravada.rows[0].r).toBe("registrada");
    const fechando = fechamento.query(
      "update public.atendimentos set status = 'encerrado' where id = $1",
      [id],
    );
    await esperar(300);
    await recebimento.query("commit");
    await fechando;

    expect((await mensagensDe(id)).map((m) => m.anexo_tipo)).toEqual([null, "audio"]);
  });

  it("a mesma Mensagem do provedor gravada duas vezes devolve 'duplicada'", async () => {
    const { id } = await atendimentoComDono("Recebida duplicada");
    const c = await conexao();
    const args = [id, "x", `wamid.dup.${id}`, null];

    expect((await c.query(RECEBIDA, args)).rows[0].r).toBe("registrada");
    expect((await c.query(RECEBIDA, args)).rows[0].r).toBe("duplicada");
  });
});

describe("Mensagem do Funcionário × fechamento, transferência, desativação e perda de papel (duas conexões)", () => {
  it.each([
    ["texto", null],
    ["imagem", ANEXOS.imagem],
    ["documento", ANEXOS.documento],
    ["audio", ANEXOS.audio],
  ] as const)(
    "%s: o fechamento ganha, nada é gravado e o veredito é 'encerrada'",
    async (_, anexo) => {
      const { id, funcionario } = await atendimentoComDono(`Func ${_}`);
      const fechamento = await conexao();
      const resposta = await conexao();

      await fechamento.query("begin");
      await fechamento.query("select 1 from public.atendimentos where id = $1 for update", [id]);
      const gravando = resposta.query(DO_FUNCIONARIO, [
        id,
        funcionario,
        "resposta tardia",
        anexo ? JSON.stringify(anexo) : null,
      ]);
      await esperar(300);
      await fechamento.query("update public.atendimentos set status = 'encerrado' where id = $1", [
        id,
      ]);
      await fechamento.query("commit");

      expect((await gravando).rows[0].r).toEqual({ status: "encerrada" });
      expect(await mensagensDe(id)).toEqual([{ autor: "contato", texto: "oi", anexo_tipo: null }]);
    },
  );

  it("transferência durante a operação: o antigo dono perde a autoridade ('sem_autoridade')", async () => {
    const { id, funcionario } = await atendimentoComDono("Func transferido");
    const transferencia = await conexao();
    const resposta = await conexao();

    await transferencia.query("begin");
    await transferencia.query("select 1 from public.atendimentos where id = $1 for update", [id]);
    const gravando = resposta.query(DO_FUNCIONARIO, [id, funcionario, "resposta", null]);
    await esperar(300);
    // Vai para outro Setor e para a Fila dele (sem dono).
    await transferencia.query(
      "update public.atendimentos set setor = 'rh', funcionario_id = null, assumido_em = null, fila_desde = now() where id = $1",
      [id],
    );
    await transferencia.query("commit");

    expect((await gravando).rows[0].r).toEqual({ status: "sem_autoridade" });
    expect((await mensagensDe(id)).map((m) => m.autor)).toEqual(["contato"]);
  });

  it("a autoridade vem do perfil real: dono, Líder do Setor e Admin escrevem; outros não", async () => {
    const { id, funcionario } = await atendimentoComDono("Dono");
    const lider = await criarFuncionario("Lider do Setor", "lider_setor", SETOR);
    const admin2 = await criarFuncionario("Admin real", "admin", "administrativo");
    const colega = await criarFuncionario("Colega do Setor");
    const liderOutroSetor = await criarFuncionario("Lider de outro Setor", "lider_setor", "rh");
    const c = await conexao();
    const gravar = async (ator: string) =>
      (await c.query(DO_FUNCIONARIO, [id, ator, "oi", null])).rows[0].r.status;

    expect(await gravar(funcionario)).toBe("registrada");
    expect(await gravar(lider)).toBe("registrada");
    expect(await gravar(admin2)).toBe("registrada");
    expect(await gravar(colega)).toBe("sem_autoridade");
    expect(await gravar(liderOutroSetor)).toBe("sem_autoridade");
    expect(await gravar("00000000-0000-0000-0000-000000000000")).toBe("sem_autoridade");
  });

  it("papel e setor não são argumentos: a função só aceita o id do ator", async () => {
    const { id } = await atendimentoComDono("Dono sem poder");
    const colega = await criarFuncionario("Colega sem poder");
    const c = await conexao();

    await expect(
      c.query(
        "select public.registrar_mensagem_do_funcionario($1::uuid, $2::uuid, $3::public.papel, $4::public.setor_slug, 'oi', null)",
        [id, colega, "lider_setor", SETOR],
      ),
    ).rejects.toThrow();
    expect((await c.query(DO_FUNCIONARIO, [id, colega, "oi", null])).rows[0].r.status).toBe(
      "sem_autoridade",
    );
  });

  it("Líder desativado antes da gravação, na conversa de outro Funcionário: nada é gravado", async () => {
    const { id } = await atendimentoComDono("Dono do Lider");
    const lider = await criarFuncionario("Lider desativado", "lider_setor", SETOR);
    const desativacao = await conexao();
    const resposta = await conexao();

    await desativacao.query("begin");
    await desativacao.query("update public.perfis set desativado_em = now() where id = $1", [
      lider,
    ]);
    const gravando = resposta.query(DO_FUNCIONARIO, [id, lider, "depois de desativado", null]);
    await esperar(300);
    await desativacao.query("commit");

    expect((await gravando).rows[0].r).toEqual({ status: "sem_autoridade" });
    expect((await mensagensDe(id)).map((m) => m.autor)).toEqual(["contato"]);
  });

  it("Líder rebaixado a Funcionário antes da gravação: nada é gravado", async () => {
    const { id } = await atendimentoComDono("Dono do Lider rebaixado");
    const lider = await criarFuncionario("Lider rebaixado", "lider_setor", SETOR);
    const troca = await conexao();
    const resposta = await conexao();

    await troca.query("begin");
    await troca.query("update public.perfis set papel = 'funcionario' where id = $1", [lider]);
    const gravando = resposta.query(DO_FUNCIONARIO, [id, lider, "depois do rebaixamento", null]);
    await esperar(300);
    await troca.query("commit");

    expect((await gravando).rows[0].r).toEqual({ status: "sem_autoridade" });
    expect((await mensagensDe(id)).map((m) => m.autor)).toEqual(["contato"]);
  });

  it("dono desativado antes da gravação: nada é gravado", async () => {
    const { id, funcionario } = await atendimentoComDono("Dono desativado");
    const desativacao = await conexao();
    const resposta = await conexao();

    await desativacao.query("begin");
    await desativacao.query("update public.perfis set desativado_em = now() where id = $1", [
      funcionario,
    ]);
    const gravando = resposta.query(DO_FUNCIONARIO, [id, funcionario, "tarde", null]);
    await esperar(300);
    await desativacao.query("commit");

    expect((await gravando).rows[0].r).toEqual({ status: "sem_autoridade" });
  });
});

describe("Entrega da Mensagem do Funcionário: pendente → entregue | falha (R85-01.B)", () => {
  const FINALIZAR = "select public.finalizar_entrega_mensagem_do_funcionario($1::uuid, $2) as r";

  async function entregaDe(mensagemId: string) {
    const { data } = await admin.from("mensagens").select("entrega").eq("id", mensagemId).single();
    return data?.entrega;
  }

  async function ultimaDoFuncionario(id: string) {
    const { data } = await admin.rpc("atendimentos_para_inatividade");
    return (data as { id: string; ultima_do_funcionario: string | null }[]).find((a) => a.id === id)
      ?.ultima_do_funcionario;
  }

  it("nasce pendente, não conta como resposta e só vira entregue com o aceite (idempotente)", async () => {
    const { id, funcionario } = await atendimentoComDono("Entrega ok");
    const c = await conexao();
    const registrada = (await c.query(DO_FUNCIONARIO, [id, funcionario, "oi", null])).rows[0].r;

    expect(await entregaDe(registrada.id)).toBe("pendente");
    expect(await ultimaDoFuncionario(id)).toBeNull();

    expect((await c.query(FINALIZAR, [registrada.id, true])).rows[0].r).toBe(true);
    expect(await entregaDe(registrada.id)).toBe("entregue");
    expect(await ultimaDoFuncionario(id)).not.toBeNull();
    // Reentrega da confirmação, ou uma falha tardia, não muda o que já foi fechado.
    expect((await c.query(FINALIZAR, [registrada.id, false])).rows[0].r).toBe(false);
    expect(await entregaDe(registrada.id)).toBe("entregue");
  });

  it("falha fica na conversa (evidência), não conta como resposta e não toca a Mensagem do contato", async () => {
    const { id, funcionario } = await atendimentoComDono("Entrega falha");
    const c = await conexao();
    const registrada = (
      await c.query(DO_FUNCIONARIO, [
        id,
        funcionario,
        "vai falhar",
        JSON.stringify(ANEXOS.documento),
      ])
    ).rows[0].r;
    const doContato = await admin
      .from("mensagens")
      .select("id")
      .eq("atendimento_id", id)
      .eq("autor", "contato")
      .single();

    await c.query(FINALIZAR, [registrada.id, false]);
    await c.query(FINALIZAR, [doContato.data!.id, false]);

    expect(await entregaDe(registrada.id)).toBe("falha");
    expect(await entregaDe(doContato.data!.id)).toBe("entregue");
    expect(await ultimaDoFuncionario(id)).toBeNull();
    // A linha e o anexo continuam (referência preservada).
    expect(await mensagensDe(id)).toEqual([
      { autor: "contato", texto: "oi", anexo_tipo: null },
      { autor: "funcionario", texto: "vai falhar", anexo_tipo: "documento" },
    ]);
  });

  it("envio pendente recente adia o aviso de inatividade; a falha o libera", async () => {
    const { id, funcionario } = await atendimentoComDono("Aviso e pendente");
    const c = await conexao();
    // A leitura do job é posterior à Mensagem do contato e anterior ao envio que sai agora.
    // Relógio do banco (o do Node pode estar defasado em relação ao do container).
    const visto = (await c.query("select clock_timestamp() as t")).rows[0].t.toISOString();
    await esperar(50);
    const registrada = (await c.query(DO_FUNCIONARIO, [id, funcionario, "saindo", null])).rows[0].r;
    const MARCAR =
      "select public.marcar_aviso_inatividade($1::uuid, 'contato'::public.autor_mensagem, $2::timestamptz) as r";

    expect((await c.query(MARCAR, [id, visto])).rows[0].r).toBe(false);
    await c.query(FINALIZAR, [registrada.id, false]);
    expect((await c.query(MARCAR, [id, visto])).rows[0].r).toBe(true);
  });
});
