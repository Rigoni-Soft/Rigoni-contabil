/**
 * Integração infra ↔ Supabase (testes.md, seção 3) do Funcionário que desconecta (signOut real)
 * mantém o Atendimento atribuído, nada é redistribuído e o histórico segue intacto.
 * Requer `npx supabase start` local com migrations + seed aplicados.
 */
import { createClient } from "@supabase/supabase-js";

import { abrirComDono } from "../../../../../test-support/atendimento-com-dono";
import { SupabaseAtendimentoRepository } from "./atendimento.repository";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const repositorio = new SupabaseAtendimentoRepository(admin);

// Setor só desta suíte (nenhuma outra suíte cria Atendimentos nele): a Fila é do Setor inteiro.
const SETOR = "financeiro" as const;
const TELEFONES = ["61955580001", "61955580002"];
const SENHA = "senha-de-teste-123";
const usuarios: string[] = [];

afterAll(async () => {
  await admin.from("atendimentos").delete().in("telefone", TELEFONES);
  for (const id of usuarios) await admin.auth.admin.deleteUser(id);
});

describe("SupabaseAtendimentoRepository — desconexão do Funcionário", () => {
  it("desconectar não tira o Atendimento, não redistribui e o histórico volta intacto ao reconectar", async () => {
    const email = `desconexao-48-${Date.now()}@teste.local`;
    const { data } = await admin.auth.admin.createUser({
      email,
      password: SENHA,
      email_confirm: true,
    });
    const funcionarioId = data.user!.id;
    usuarios.push(funcionarioId);
    await admin.from("perfis").insert({
      id: funcionarioId,
      nome: "Desconecta 48",
      email,
      papel: "funcionario",
      setor: SETOR,
    });

    const atendimentoId = await abrirComDono(
      admin,
      repositorio,
      {
        telefone: TELEFONES[0],
        chave: TELEFONES[0],
        clienteId: null,
        setor: SETOR,
        mensagens: [
          { autor: "contato", texto: "oi" },
          { autor: "funcionario", texto: "bom dia" },
        ],
      },
      funcionarioId,
    );

    // Conecta e desconecta de verdade.
    const sessao = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    expect((await sessao.auth.signInWithPassword({ email, password: SENHA })).error).toBeNull();
    expect((await sessao.auth.signOut()).error).toBeNull();

    // Atendimento novo no mesmo Setor: espera sem dono e não herda o dono offline.
    const novo = await repositorio.abrir({
      telefone: TELEFONES[1],
      chave: TELEFONES[1],
      clienteId: null,
      setor: SETOR,
      mensagens: [{ autor: "contato", texto: "alô" }],
    });
    if (!novo.ok) throw new Error("abertura falhou");
    const gravado = await admin
      .from("atendimentos")
      .select("funcionario_id")
      .eq("id", novo.value.id)
      .single();
    expect(gravado.data?.funcionario_id).toBeNull();

    // Continua atribuído a ele, em andamento.
    expect(await repositorio.buscarEmAndamento(atendimentoId)).toMatchObject({
      ok: true,
      value: { id: atendimentoId, funcionarioId },
    });

    // Ao voltar, retoma a conversa: o histórico está lá e a nova mensagem entra na ordem.
    expect((await sessao.auth.signInWithPassword({ email, password: SENHA })).error).toBeNull();
    const anexada = await repositorio.anexarMensagem(TELEFONES[0], {
      autor: "funcionario",
      texto: "voltei",
    });
    expect(anexada.ok).toBe(true);
    const historico = await admin
      .from("mensagens")
      .select("autor, texto")
      .eq("atendimento_id", atendimentoId)
      .order("criado_em");
    expect(historico.data).toEqual([
      { autor: "contato", texto: "oi" },
      { autor: "funcionario", texto: "bom dia" },
      { autor: "funcionario", texto: "voltei" },
    ]);
    await sessao.auth.signOut();
  });
});
