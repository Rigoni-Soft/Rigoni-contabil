/**
 * Integração infra ↔ Supabase (testes.md, seção 3) da reação à Mensagem do cliente (#84): o id da
 * Mensagem no provedor é guardado na abertura e no anexo, e a reação é lida e gravada.
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

const TELEFONE = "61955584001";

afterAll(async () => {
  await admin.from("atendimentos").delete().eq("chave_telefone", TELEFONE);
});

describe("SupabaseAtendimentoRepository — reação (#84)", () => {
  let atendimentoId: string;

  it("guarda o id do provedor da Mensagem do contato na abertura e no anexo", async () => {
    const aberto = await repositorio.abrir({
      telefone: `55${TELEFONE}`,
      chave: TELEFONE,
      clienteId: null,
      setor: "recepcao",
      funcionarioId: null,
      mensagens: [
        { autor: "contato", texto: "preciso do contrato", idExterno: "wamid.ABERTURA" },
        { autor: "ura", texto: "Já vamos te atender" },
      ],
    });
    if (!aberto.ok || aberto.value.status !== "aberto") throw new Error("abertura falhou");
    atendimentoId = aberto.value.id;

    const anexada = await repositorio.anexarMensagem(TELEFONE, {
      autor: "contato",
      texto: "pode ser hoje?",
      idExterno: "wamid.ANEXO",
    });
    expect(anexada.ok && anexada.value.anexada).toBe(true);

    const { data } = await admin
      .from("mensagens")
      .select("texto, id_externo")
      .eq("atendimento_id", atendimentoId)
      .order("criado_em");
    expect(data).toEqual([
      { texto: "preciso do contrato", id_externo: "wamid.ABERTURA" },
      { texto: "Já vamos te atender", id_externo: null },
      { texto: "pode ser hoje?", id_externo: "wamid.ANEXO" },
    ]);
  });

  it("lê a Mensagem para reagir, grava a reação, mostra na conversa e remove", async () => {
    const { data } = await admin
      .from("mensagens")
      .select("id")
      .eq("atendimento_id", atendimentoId)
      .eq("id_externo", "wamid.ANEXO")
      .single();
    const mensagemId = data!.id as string;

    const antes = await repositorio.mensagemParaReacao(atendimentoId, mensagemId);
    expect(antes.ok && antes.value).toEqual({
      autor: "contato",
      idExterno: "wamid.ANEXO",
      reacao: null,
    });

    expect((await repositorio.registrarReacao(mensagemId, "👍")).ok).toBe(true);
    const conversa = await repositorio.conversa(atendimentoId);
    const lida = conversa.ok && conversa.value?.mensagens.find((m) => m.id === mensagemId);
    expect(lida).toMatchObject({ idExterno: "wamid.ANEXO", reacao: "👍" });

    expect((await repositorio.registrarReacao(mensagemId, null)).ok).toBe(true);
    const depois = await repositorio.mensagemParaReacao(atendimentoId, mensagemId);
    expect(depois.ok && depois.value?.reacao).toBeNull();
  });

  it("Mensagem de outro Atendimento ou inexistente não é encontrada", async () => {
    const r = await repositorio.mensagemParaReacao(atendimentoId, crypto.randomUUID());

    expect(r.ok && r.value).toBeNull();
  });
});
