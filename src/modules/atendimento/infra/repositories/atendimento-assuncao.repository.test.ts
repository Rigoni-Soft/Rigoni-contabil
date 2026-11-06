/**
 * Integração infra ↔ Supabase (testes.md, seção 3) de assumir um Atendimento da espera do Setor.
 * Requer `npx supabase start` local com migrations + seed aplicados.
 */
import { createClient } from "@supabase/supabase-js";

import { SupabaseAtendimentoRepository } from "./atendimento.repository";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const repositorio = new SupabaseAtendimentoRepository(admin);

// A espera comum (sem destinatário) existe só na Recepção: é onde dois Funcionários disputam o clique.
const SETOR = "recepcao" as const;
const OUTRO_SETOR = "rh" as const;
const TELEFONES = [
  "61955580001",
  "61955580002",
  "61955580003",
  "61955580004",
  "61955580005",
  "61955580008",
];
const usuarios: string[] = [];

async function criarUsuario(
  nome: string,
  papel: "funcionario" | "lider_setor" | "admin" = "funcionario",
  setor: string = SETOR,
): Promise<string> {
  const { data } = await admin.auth.admin.createUser({
    email: `assumir-161-${nome.replace(/\W/g, "")}-${Date.now()}@teste.local`,
    password: "senha-de-teste-123",
    email_confirm: true,
  });
  const id = data.user!.id;
  usuarios.push(id);
  await admin.from("perfis").insert({ id, nome, email: data.user!.email, papel, setor });
  return id;
}

// Atendimento aguardando no Setor, sem dono: gravado direto, como no estado de espera.
async function emEspera(telefone: string): Promise<string> {
  const { data, error } = await admin
    .from("atendimentos")
    .insert({ telefone, chave_telefone: telefone, setor: SETOR })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

afterAll(async () => {
  await admin.from("atendimentos").delete().in("telefone", TELEFONES);
  for (const id of usuarios) await admin.auth.admin.deleteUser(id);
});

describe("SupabaseAtendimentoRepository — assumir da espera", () => {
  it("assumir torna o usuário dono, grava o evento de assunção e a auditoria", async () => {
    const quem = await criarUsuario("Ana Assume");
    const id = await emEspera(TELEFONES[0]);

    expect(await repositorio.assumir(id, quem)).toEqual({
      ok: true,
      value: { status: "assumido" },
    });

    const { data: at } = await admin
      .from("atendimentos")
      .select("funcionario_id, status, fila_desde, assumido_em")
      .eq("id", id)
      .single();
    expect(at).toMatchObject({ funcionario_id: quem, status: "em_andamento", fila_desde: null });
    expect(at!.assumido_em).not.toBeNull();

    const { data: eventos } = await admin
      .from("assuncoes_atendimento")
      .select("funcionario_id")
      .eq("atendimento_id", id);
    expect(eventos).toEqual([{ funcionario_id: quem }]);

    const { data: auditoria } = await admin
      .from("registros_auditoria")
      .select("ator, setor, resultado")
      .eq("acao", "atendimento.assumir")
      .eq("alvo", id);
    expect(auditoria).toEqual([{ ator: quem, setor: SETOR, resultado: "sucesso" }]);
  });

  it("Líder e Admin do Setor também assumem, e quem já atende outro assume mais um", async () => {
    const lider = await criarUsuario("Lia Lider", "lider_setor");
    const admn = await criarUsuario("Adão Admin", "admin");
    const [a, b, c] = [
      await emEspera(TELEFONES[1]),
      await emEspera(TELEFONES[2]),
      await emEspera(TELEFONES[3]),
    ];

    for (const [id, quem] of [
      [a, lider],
      [b, admn],
      [c, lider],
    ] as const) {
      expect(await repositorio.assumir(id, quem)).toEqual({
        ok: true,
        value: { status: "assumido" },
      });
    }
  });

  it("duas assunções concorrentes: uma vence e a outra recebe 'já assumido'", async () => {
    const x = await criarUsuario("Xavier Corrida");
    const y = await criarUsuario("Yara Corrida");
    const id = await emEspera(TELEFONES[4]);

    const [rx, ry] = await Promise.all([repositorio.assumir(id, x), repositorio.assumir(id, y)]);

    const status = [rx, ry].map((r) => (r.ok ? r.value.status : "erro")).sort();
    expect(status).toEqual(["assumido", "ja_assumido"]);
    const { data: eventos } = await admin
      .from("assuncoes_atendimento")
      .select("funcionario_id")
      .eq("atendimento_id", id);
    expect(eventos).toHaveLength(1);
  });

  it("usuário desativado ou de outro Setor não assume e nada é gravado", async () => {
    const desativado = await criarUsuario("Dora Desativada");
    await admin
      .from("perfis")
      .update({ desativado_em: new Date().toISOString() })
      .eq("id", desativado);
    const deOutroSetor = await criarUsuario("Otto Outro", "funcionario", OUTRO_SETOR);
    const id = await emEspera("61955580006");
    TELEFONES.push("61955580006");

    for (const quem of [desativado, deOutroSetor]) {
      expect(await repositorio.assumir(id, quem)).toEqual({
        ok: true,
        value: { status: "inelegivel" },
      });
    }
    const { data: at } = await admin
      .from("atendimentos")
      .select("funcionario_id")
      .eq("id", id)
      .single();
    expect(at!.funcionario_id).toBeNull();
    const { count } = await admin
      .from("assuncoes_atendimento")
      .select("*", { count: "exact", head: true })
      .eq("atendimento_id", id);
    expect(count).toBe(0);
  });

  it("espera dirigida: só o destinatário assume; Líder, Admin e colega do Setor são inelegíveis", async () => {
    const destinatario = await criarUsuario("Rita Responsavel");
    const lider = await criarUsuario("Lia Lider", "lider_setor");
    const adm = await criarUsuario("Ari Admin", "admin", "administrativo");
    const colega = await criarUsuario("Caio Colega");
    const id = await emEspera("61955580008");
    await admin.from("atendimentos").update({ fila_funcionario_id: destinatario }).eq("id", id);

    for (const quem of [lider, adm, colega]) {
      expect(await repositorio.assumir(id, quem)).toEqual({
        ok: true,
        value: { status: "inelegivel" },
      });
    }
    expect(await repositorio.assumir(id, destinatario)).toEqual({
      ok: true,
      value: { status: "assumido" },
    });
  });

  it("fora da Recepção, Atendimento sem destinatário não é assumido por ninguém do Setor", async () => {
    const funcionario = await criarUsuario("Fábio Funcionario", "funcionario", OUTRO_SETOR);
    const lider = await criarUsuario("Lúcia Lider", "lider_setor", OUTRO_SETOR);
    const { data, error } = await admin
      .from("atendimentos")
      .insert({ telefone: "61955580009", chave_telefone: "61955580009", setor: OUTRO_SETOR })
      .select("id")
      .single();
    if (error) throw error;
    TELEFONES.push("61955580009");

    for (const quem of [funcionario, lider]) {
      expect(await repositorio.assumir(data.id, quem)).toEqual({
        ok: true,
        value: { status: "inelegivel" },
      });
    }
  });

  it("Atendimento inexistente ou encerrado não é assumido", async () => {
    const quem = await criarUsuario("Nina Nada");
    const encerrado = await emEspera("61955580007");
    TELEFONES.push("61955580007");
    await admin.from("atendimentos").update({ status: "encerrado" }).eq("id", encerrado);

    for (const id of [crypto.randomUUID(), encerrado]) {
      expect(await repositorio.assumir(id, quem)).toEqual({
        ok: true,
        value: { status: "inexistente" },
      });
    }
  });
});
