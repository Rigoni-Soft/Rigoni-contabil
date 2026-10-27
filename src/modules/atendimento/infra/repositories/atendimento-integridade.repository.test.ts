/**
 * Integração infra ↔ Supabase (testes.md, seção 3) das garantias de integridade: só atendente
 * ativo e do Setor recebe uma Transferência dirigida, e nada é atribuído sem assunção. Requer
 * `npx supabase start` local com migrations + seed.
 */
import { createClient } from "@supabase/supabase-js";

import { abrirComDono } from "../../../../../test-support/atendimento-com-dono";
import { SupabaseAtendimentoRepository } from "./atendimento.repository";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const repositorio = new SupabaseAtendimentoRepository(admin);

// Setor só desta suíte (nenhuma outra o usa para Atendimento) e números longe das outras.
const SETOR = "administrativo" as const;
const OUTRO_SETOR = "tributario" as const;
const telefone = (n: number) => `619555730${String(n).padStart(2, "0")}`;
const usuarios: string[] = [];
const telefonesUsados: string[] = [];
let proximoNumero = 1;

async function criarPerfil(
  nome: string,
  setor: string = SETOR,
  papel: "funcionario" | "lider_setor" = "funcionario",
): Promise<string> {
  const { data } = await admin.auth.admin.createUser({
    email: `integridade-77-${nome.replace(/\W/g, "")}-${Date.now()}@teste.local`,
    password: "senha-de-teste-123",
    email_confirm: true,
  });
  const id = data.user!.id;
  usuarios.push(id);
  const { error } = await admin
    .from("perfis")
    .insert({ id, nome, email: data.user!.email, papel, setor });
  if (error) throw error;
  return id;
}

const desativar = (id: string) =>
  admin.from("perfis").update({ desativado_em: new Date().toISOString() }).eq("id", id);

function numero(): string {
  const n = telefone(proximoNumero++);
  telefonesUsados.push(n);
  return n;
}

async function abrir(funcionarioId: string | null, setor: string = SETOR) {
  const tel = numero();
  const abertura = {
    telefone: tel,
    chave: tel,
    clienteId: null,
    setor: setor as typeof SETOR,
    mensagens: [{ autor: "contato" as const, texto: "oi" }],
  };
  if (funcionarioId) {
    return { telefone: tel, id: await abrirComDono(admin, repositorio, abertura, funcionarioId) };
  }
  const r = await repositorio.abrir(abertura);
  if (!r.ok) throw new Error("falha técnica ao abrir");
  return { telefone: tel, id: r.value.id };
}

async function atendimentoDe(tel: string) {
  const { data } = await admin
    .from("atendimentos")
    .select("id, setor, funcionario_id, fila_funcionario_id")
    .eq("chave_telefone", tel);
  return data ?? [];
}

afterAll(async () => {
  await admin.from("atendimentos").delete().in("chave_telefone", telefonesUsados);
  for (const id of usuarios) await admin.auth.admin.deleteUser(id);
});

describe("B2 — só atendente ativo e do Setor recebe Atendimento", () => {
  it("transferir para desativado ou para alguém de outro Setor é recusado e o Atendimento não muda", async () => {
    const origem = await criarPerfil("Origem B2", OUTRO_SETOR);
    const inativo = await criarPerfil("Destino Inativo B2");
    await desativar(inativo);
    const deOutroSetor = await criarPerfil("Destino Outro Setor B2", "financeiro");
    const { telefone: tel, id } = await abrir(origem, OUTRO_SETOR);

    for (const destino of [inativo, deOutroSetor]) {
      const r = await repositorio.transferir({
        atendimentoId: id,
        origemFuncionarioId: origem,
        setorOrigem: OUTRO_SETOR,
        setorDestino: SETOR,
        dirigidoA: destino,
        resumo: "x",
        ator: { id: origem, setor: OUTRO_SETOR },
      });
      expect(r.ok && r.value.status).toBe("conflito");
    }
    expect(await atendimentoDe(tel)).toEqual([
      { id, setor: OUTRO_SETOR, funcionario_id: origem, fila_funcionario_id: null },
    ]);
  });

  it("Líder desativado não é escolhido e não derruba a consulta quando há outro ativo no Setor", async () => {
    const antigo = await criarPerfil("Lider Antigo B2", SETOR, "lider_setor");
    await desativar(antigo);
    const atual = await criarPerfil("Lider Atual B2", SETOR, "lider_setor");

    const r = await repositorio.liderDoSetor(SETOR);

    expect(r).toEqual({ ok: true, value: atual });
  });
});

describe("assunção é evento, não distribuição", () => {
  it("abrir e transferir não geram assunção: ninguém ganha Atendimento sozinho", async () => {
    const livre = await criarPerfil("Livre Sem Assuncao");
    const origem = await criarPerfil("Origem Sem Assuncao", OUTRO_SETOR);
    const espera = await abrir(null);
    const doOrigem = await abrir(origem, OUTRO_SETOR);
    await admin.from("assuncoes_atendimento").delete().eq("atendimento_id", doOrigem.id);

    const r = await repositorio.transferir({
      atendimentoId: doOrigem.id,
      origemFuncionarioId: origem,
      setorOrigem: OUTRO_SETOR,
      setorDestino: SETOR,
      dirigidoA: null,
      resumo: "x",
      ator: { id: origem, setor: OUTRO_SETOR },
    });

    expect(r.ok && r.value.status).toBe("transferido");
    for (const tel of [espera.telefone, doOrigem.telefone]) {
      expect((await atendimentoDe(tel))[0]).toMatchObject({ funcionario_id: null });
    }
    const assuncoes = await admin
      .from("assuncoes_atendimento")
      .select("id")
      .in("atendimento_id", [espera.id, doOrigem.id])
      .eq("funcionario_id", livre);
    expect(assuncoes.data).toEqual([]);
  });
});
