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
const TELEFONES = ["61955590001", "61955590002", "61955590003"];
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

async function mensagem(telefone: string, autor: "contato" | "funcionario") {
  await repositorio.anexarMensagem(telefone, { autor, texto: "msg" });
}

async function doAtendimento(id: string) {
  const lista = await repositorio.paraInatividade();
  if (!lista.ok) throw new Error("leitura falhou");
  return lista.value.find((a) => a.id === id);
}

const ATOR = { id: URA_ATOR_ID, setor: SETOR };

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

  it("marca o aviso uma vez só e limpa", async () => {
    const funcionario = await criarFuncionario("Func Inatividade B");
    const id = await abrir(TELEFONES[2], funcionario);

    expect(await repositorio.marcarAvisoInatividade(id, "funcionario")).toEqual({
      ok: true,
      value: true,
    });
    expect(await repositorio.marcarAvisoInatividade(id, "funcionario")).toEqual({
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
    expect(await repositorio.encerrarPorInatividade(id, funcionario, ATOR)).toEqual({
      ok: true,
      value: { status: "inexistente" },
    });

    // Com aviso, mas o Funcionário (o inativo) escreveu depois: recusa.
    await repositorio.marcarAvisoInatividade(id, "funcionario");
    await mensagem(TELEFONES[2], "funcionario");
    expect(await repositorio.encerrarPorInatividade(id, funcionario, ATOR)).toEqual({
      ok: true,
      value: { status: "inexistente" },
    });

    // Aviso válido, sem ação depois: encerra e audita com a URA.
    await repositorio.limparAvisoInatividade(id);
    await repositorio.marcarAvisoInatividade(id, "funcionario");
    const r = await repositorio.encerrarPorInatividade(id, funcionario, ATOR);
    // O Funcionário liberado assume o Atendimento que estava na Fila do Setor.
    expect(r.ok && r.value.status === "encerrado" && r.value.proximo?.chave).toBe(TELEFONES[1]);
    expect(await doAtendimento(id)).toBeUndefined();

    const auditoria = await admin
      .from("registros_auditoria")
      .select("acao, setor")
      .eq("ator", URA_ATOR_ID)
      .eq("alvo", id);
    expect(auditoria.data).toEqual([{ acao: "atendimento.encerrar", setor: SETOR }]);
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
