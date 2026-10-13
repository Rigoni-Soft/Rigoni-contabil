/**
 * Integração infra ↔ Supabase (testes.md, seção 3) da inatividade do Atendimento (#73).
 * Requer `npx supabase start` local com migrations + seed aplicados.
 */
import { createClient } from "@supabase/supabase-js";

import { URA_ATOR_ID } from "@/modules/atendimento/domain/services/inatividade.service";

import { SupabaseAtendimentoRepository } from "./atendimento.repository";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const repositorio = new SupabaseAtendimentoRepository(admin);

// Setor só desta suíte: encerrar mexe na Fila do Setor inteiro.
const SETOR = "administrativo" as const;
const TELEFONES = [
  "61955590001",
  "61955590002",
  "61955590003",
  "61955590004",
  "61955590005",
  "61955590006",
];
const usuarios: string[] = [];

async function criarFuncionario(nome: string): Promise<string> {
  const { data } = await admin.auth.admin.createUser({
    email: `inatividade-73-${nome.replace(/\W/g, "")}-${Date.now()}@teste.local`,
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

async function abrir(telefone: string, funcionarioId: string | null) {
  const r = await repositorio.abrir({
    telefone,
    chave: telefone,
    clienteId: null,
    setor: SETOR,
    funcionarioId,
    mensagens: [{ autor: "contato", texto: "oi" }],
  });
  if (!r.ok || r.value.status !== "aberto") throw new Error("abertura falhou");
  return r.value.id;
}

// Dono já em atendimento, gravado direto: com alguém esperando na Fila, `abrir` (corretamente, PR #77,
// B3) faria o dono assumir o mais antigo. Este teste precisa do estado "dono ocupado + Fila".
async function abrirDireto(telefone: string, funcionarioId: string): Promise<string> {
  const { data, error } = await admin
    .from("atendimentos")
    .insert({
      telefone,
      chave_telefone: telefone,
      setor: SETOR,
      funcionario_id: funcionarioId,
      assumido_em: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  await admin
    .from("assuncoes_atendimento")
    .insert({ atendimento_id: data.id, funcionario_id: funcionarioId });
  return data.id;
}

async function mensagem(telefone: string, autor: "contato" | "funcionario") {
  await repositorio.anexarMensagem(telefone, { autor, texto: "msg" });
}

async function doAtendimento(id: string) {
  const lista = await repositorio.paraInatividade();
  if (!lista.ok) throw new Error("leitura falhou");
  return lista.value.find((a) => a.id === id);
}

const ATOR = { id: URA_ATOR_ID, setor: SETOR };
const TEXTO_FINAL = "Seu atendimento foi encerrado por inatividade.";

afterAll(async () => {
  await admin.from("atendimentos").delete().in("telefone", TELEFONES);
  await admin.from("registros_auditoria").delete().eq("ator", URA_ATOR_ID);
  for (const id of usuarios) await admin.auth.admin.deleteUser(id);
});

describe("SupabaseAtendimentoRepository — inatividade", () => {
  it("lista só Atendimento com Funcionário, com a última Mensagem de cada lado", async () => {
    const funcionario = await criarFuncionario("Func Inatividade A");
    const comFuncionario = await abrir(TELEFONES[0], funcionario);
    const naFila = await abrir(TELEFONES[1], null);
    await mensagem(TELEFONES[0], "funcionario");

    const lido = await doAtendimento(comFuncionario);
    expect(lido).toMatchObject({ funcionarioId: funcionario, setor: SETOR, aviso: null });
    expect(lido?.ultimaDoContato).toBeInstanceOf(Date);
    expect(lido?.ultimaDoFuncionario).toBeInstanceOf(Date);
    expect(await doAtendimento(naFila)).toBeUndefined();
  });

  it("a reserva do aviso só vale sem Mensagem posterior ao que o job leu", async () => {
    const funcionario = await criarFuncionario("Func Inatividade Reserva");
    const id = await abrirDireto(TELEFONES[4], funcionario);
    await mensagem(TELEFONES[4], "contato");
    const lido = (await doAtendimento(id))!;

    // O contato escreve depois da leitura do job: a reserva baseada nela é recusada.
    await mensagem(TELEFONES[4], "contato");
    expect(await repositorio.marcarAvisoInatividade(id, "contato", lido.ultimaDoContato!)).toEqual({
      ok: true,
      value: false,
    });
    expect((await doAtendimento(id))?.aviso).toBeNull();

    // Releitura: reserva aceita, e o aviso ao cliente só conta como entregue depois de confirmado.
    const novo = (await doAtendimento(id))!;
    expect(await repositorio.marcarAvisoInatividade(id, "contato", novo.ultimaDoContato!)).toEqual({
      ok: true,
      value: true,
    });
    expect((await doAtendimento(id))?.avisoEntregue).toBe(false);
    expect(await repositorio.confirmarAvisoEntregue(id)).toEqual({ ok: true, value: true });
    expect(await repositorio.confirmarAvisoEntregue(id)).toEqual({ ok: true, value: false });
    expect((await doAtendimento(id))?.avisoEntregue).toBe(true);
    await repositorio.limparAvisoInatividade(id);
    expect((await doAtendimento(id))?.avisoEntregue).toBe(false);
  });

  it("não encerra com o aviso ao cliente reservado e não entregue", async () => {
    const funcionario = await criarFuncionario("Func Inatividade Sem Entrega");
    const id = await abrirDireto(TELEFONES[5], funcionario);
    await mensagem(TELEFONES[5], "contato");
    const lido = (await doAtendimento(id))!;
    await repositorio.marcarAvisoInatividade(id, "contato", lido.ultimaDoContato!);

    expect(await repositorio.encerrarPorInatividade(id, funcionario, ATOR, TEXTO_FINAL)).toEqual({
      ok: true,
      value: { status: "inexistente" },
    });
    expect(await idDe(TELEFONES[5])).toBe(id);
  });

  it("marca o aviso uma vez só e limpa", async () => {
    const funcionario = await criarFuncionario("Func Inatividade B");
    const id = await abrirDireto(TELEFONES[2], funcionario);

    expect(await repositorio.marcarAvisoInatividade(id, "funcionario", new Date())).toEqual({
      ok: true,
      value: true,
    });
    expect(await repositorio.marcarAvisoInatividade(id, "funcionario", new Date())).toEqual({
      ok: true,
      value: false,
    });
    expect((await doAtendimento(id))?.aviso).toMatchObject({ de: "funcionario" });

    // Em aviso, o Atendimento não muda de Setor nem de dono (guarda do banco contra a corrida).
    const troca = await admin.from("atendimentos").update({ setor: "financeiro" }).eq("id", id);
    expect(troca.error?.message).toContain("nao pode ser transferido");

    expect((await repositorio.limparAvisoInatividade(id)).ok).toBe(true);
    expect((await doAtendimento(id))?.aviso).toBeNull();
  });

  it("encerra por inatividade só com o aviso marcado e sem ação de quem estava inativo, auditando a URA", async () => {
    const id = await idDe(TELEFONES[2]);
    const funcionario = (await doAtendimento(id))!.funcionarioId;

    // Sem aviso: recusa.
    expect(await repositorio.encerrarPorInatividade(id, funcionario, ATOR, TEXTO_FINAL)).toEqual({
      ok: true,
      value: { status: "inexistente" },
    });

    // Com aviso, mas o Funcionário (o inativo) escreveu depois: recusa.
    await repositorio.marcarAvisoInatividade(id, "funcionario", new Date());
    await mensagem(TELEFONES[2], "funcionario");
    expect(await repositorio.encerrarPorInatividade(id, funcionario, ATOR, TEXTO_FINAL)).toEqual({
      ok: true,
      value: { status: "inexistente" },
    });

    // Aviso válido, sem ação depois: encerra e audita com a URA.
    await repositorio.limparAvisoInatividade(id);
    await repositorio.marcarAvisoInatividade(id, "funcionario", new Date());
    const r = await repositorio.encerrarPorInatividade(id, funcionario, ATOR, TEXTO_FINAL);
    // O Funcionário liberado assume o Atendimento que estava na Fila do Setor.
    expect(r.ok && r.value.status === "encerrado" && r.value.proximo?.chave).toBe(TELEFONES[1]);
    expect(await doAtendimento(id)).toBeUndefined();

    const auditoria = await admin
      .from("registros_auditoria")
      .select("acao, setor")
      .eq("ator", URA_ATOR_ID)
      .eq("alvo", id);
    expect(auditoria.data).toEqual([{ acao: "atendimento.encerrar", setor: SETOR }]);

    // A mensagem final da URA entrou no histórico na mesma transação e fica pendente de entrega.
    const final = await admin
      .from("mensagens")
      .select("autor, texto")
      .eq("atendimento_id", id)
      .eq("autor", "ura");
    expect(final.data).toEqual([{ autor: "ura", texto: TEXTO_FINAL }]);
    const pendentes = await repositorio.encerramentosPendentes();
    expect(pendentes.ok && pendentes.value).toContainEqual({
      atendimentoId: id,
      telefone: TELEFONES[2],
      texto: TEXTO_FINAL,
    });
    expect(await repositorio.confirmarEncerramentoEntregue(id)).toEqual({ ok: true, value: true });
    const depois = await repositorio.encerramentosPendentes();
    expect(depois.ok && depois.value.map((p) => p.atendimentoId)).not.toContain(id);
  });
});

describe("inatividade × desativação do dono", () => {
  it("desativar o dono de um Atendimento em aviso o devolve à Fila e limpa o aviso, sem apagar nada", async () => {
    const dono = await criarFuncionario("Func Desativado Em Aviso");
    const id = await abrirDireto(TELEFONES[3], dono);
    await mensagem(TELEFONES[3], "contato");
    await repositorio.marcarAvisoInatividade(id, "funcionario", new Date());

    const r = await admin.rpc("desativar_usuario", {
      alvo_id: dono,
      ator_id: "11111111-1111-1111-1111-111111111111",
    });

    expect(r.error).toBeNull();
    const { data } = await admin
      .from("atendimentos")
      .select("status, funcionario_id, aviso_inatividade_em, aviso_inatividade_de")
      .eq("id", id)
      .single();
    expect(data).toMatchObject({
      status: "em_andamento",
      aviso_inatividade_em: null,
      aviso_inatividade_de: null,
    });
    // Sem o dono: na Fila ou já com quem estava livre no Setor.
    expect(data?.funcionario_id).not.toBe(dono);
    const mensagens = await admin.from("mensagens").select("id").eq("atendimento_id", id);
    expect(mensagens.data).toHaveLength(1);
  });
});

async function idDe(telefone: string): Promise<string> {
  const { data } = await admin
    .from("atendimentos")
    .select("id")
    .eq("chave_telefone", telefone)
    .eq("status", "em_andamento")
    .single();
  return data!.id;
}
