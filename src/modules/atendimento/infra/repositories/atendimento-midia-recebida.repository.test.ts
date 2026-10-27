/**
 * Integração infra ↔ Supabase (testes.md, seção 3) da mídia recebida do cliente: localizar o
 * Atendimento em andamento do número, saber se a Mensagem do provedor já entrou e gravar a Mensagem
 * do contato com anexo (ou o aviso do sistema). Requer `npx supabase start` local com migrations.
 */
import { createClient } from "@supabase/supabase-js";

import { SupabaseAtendimentoRepository } from "./atendimento.repository";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const repositorio = new SupabaseAtendimentoRepository(admin);

const TELEFONE = "61955584081";
const SEM_ATENDIMENTO = "61955584082";

afterAll(async () => {
  await admin.from("atendimentos").delete().eq("chave_telefone", TELEFONE);
});

describe("SupabaseAtendimentoRepository — mídia recebida (#81)", () => {
  let atendimentoId: string;

  beforeAll(async () => {
    const aberto = await repositorio.abrir({
      telefone: `55${TELEFONE}`,
      chave: TELEFONE,
      clienteId: null,
      setor: "recepcao",
      mensagens: [{ autor: "contato", texto: "oi" }],
    });
    if (!aberto.ok) throw new Error("abertura falhou");
    atendimentoId = aberto.value.id;
  });

  it("número sem Atendimento em andamento: null", async () => {
    const r = await repositorio.atendimentoParaMidia(SEM_ATENDIMENTO, "wamid.X");
    expect(r.ok && r.value).toBeNull();
  });

  it("localiza o Atendimento e diz que a Mensagem do provedor ainda não entrou", async () => {
    const r = await repositorio.atendimentoParaMidia(TELEFONE, "wamid.MIDIA");
    expect(r.ok && r.value).toEqual({ atendimentoId, jaRegistrada: false });
  });

  it("grava a Mensagem do contato com o anexo e a reentrega passa a ser reconhecida", async () => {
    const gravada = await repositorio.registrarMensagemRecebida(atendimentoId, {
      autor: "contato",
      texto: "",
      idExterno: "wamid.MIDIA",
      anexo: {
        tipo: "audio",
        nome: "audio.ogg",
        tamanho: 2048,
        caminho: `${atendimentoId}/u/audio.ogg`,
        miniaturaCaminho: null,
      },
    });
    expect(gravada.ok && gravada.value).toBe("registrada");

    const { data } = await admin
      .from("mensagens")
      .select("autor, texto, id_externo, anexo_tipo, anexo_nome, anexo_tamanho, anexo_caminho")
      .eq("atendimento_id", atendimentoId)
      .eq("id_externo", "wamid.MIDIA")
      .single();
    expect(data).toEqual({
      autor: "contato",
      texto: "",
      id_externo: "wamid.MIDIA",
      anexo_tipo: "audio",
      anexo_nome: "audio.ogg",
      anexo_tamanho: 2048,
      anexo_caminho: `${atendimentoId}/u/audio.ogg`,
    });

    const r = await repositorio.atendimentoParaMidia(TELEFONE, "wamid.MIDIA");
    expect(r.ok && r.value).toEqual({ atendimentoId, jaRegistrada: true });
  });

  it("a mesma Mensagem do provedor gravada de novo não duplica e devolve duplicada", async () => {
    const r = await repositorio.registrarMensagemRecebida(atendimentoId, {
      autor: "contato",
      texto: "",
      idExterno: "wamid.MIDIA",
    });
    expect(r.ok && r.value).toBe("duplicada");
    const { count } = await admin
      .from("mensagens")
      .select("id", { count: "exact", head: true })
      .eq("atendimento_id", atendimentoId)
      .eq("id_externo", "wamid.MIDIA");
    expect(count).toBe(1);
  });

  it("aviso do sistema entra como Mensagem da URA, sem anexo", async () => {
    const r = await repositorio.registrarMensagemRecebida(atendimentoId, {
      autor: "ura",
      texto: "O cliente enviou um arquivo que não pôde ser recebido.",
      idExterno: "wamid.RECUSADA",
    });
    expect(r.ok && r.value).toBe("registrada");
    const { data } = await admin
      .from("mensagens")
      .select("autor, anexo_tipo")
      .eq("atendimento_id", atendimentoId)
      .eq("id_externo", "wamid.RECUSADA")
      .single();
    expect(data).toEqual({ autor: "ura", anexo_tipo: null });
  });
});
