/**
 * Integração infra ↔ Supabase (testes.md, seção 3) da sessão da URA (#41).
 * Requer `npx supabase start` local com migrations + seed aplicados.
 */
import { createClient } from "@supabase/supabase-js";

import { SupabaseSessaoAtendimentoGateway } from "./supabase-sessao-atendimento.gateway";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const gateway = new SupabaseSessaoAtendimentoGateway(admin, "segredo-teste");
const TELEFONE = "61988887777";

afterEach(async () => {
  await admin.from("atendimento_sessoes").delete().neq("chave", "");
});

describe("SupabaseSessaoAtendimentoGateway", () => {
  it("sem sessão devolve null", async () => {
    expect(await gateway.obter(TELEFONE)).toEqual({ ok: true, value: null });
  });

  it.each([
    [{ etapa: "tipo_documento" as const }],
    [{ etapa: "alteracao" as const, modo: "ambos" as const, pagina: 2, lista: "abc123" }],
    [{ etapa: "ja_cliente" as const, invalidos: 1 }],
    [{ etapa: "cnpj" as const, invalidos: 0 }],
    [{ etapa: "cnpj_nova_tentativa" as const, invalidos: 0 }],
    [{ etapa: "cnpj_nova_tentativa" as const, invalidos: 1 }],
    [{ etapa: "cnpj" as const, invalidos: 2 }],
  ])("grava e lê a sessão %j", async (sessao) => {
    expect((await gateway.salvar(TELEFONE, sessao)).ok).toBe(true);
    expect(await gateway.obter(TELEFONE)).toEqual({ ok: true, value: sessao });
  });

  it("regravar a sessão em outra etapa substitui o contador de invalidos", async () => {
    await gateway.salvar(TELEFONE, { etapa: "cnpj", invalidos: 2 });
    await gateway.salvar(TELEFONE, { etapa: "cnpj_nova_tentativa", invalidos: 0 });
    expect(await gateway.obter(TELEFONE)).toEqual({
      ok: true,
      value: { etapa: "cnpj_nova_tentativa", invalidos: 0 },
    });
  });

  it("salvar de novo substitui; limpar remove", async () => {
    await gateway.salvar(TELEFONE, { etapa: "tipo_documento" });
    await gateway.salvar(TELEFONE, {
      etapa: "alteracao",
      modo: "alteracoes",
      pagina: 1,
      lista: "abc123",
    });
    expect(await gateway.obter(TELEFONE)).toEqual({
      ok: true,
      value: { etapa: "alteracao", modo: "alteracoes", pagina: 1, lista: "abc123" },
    });
    await gateway.limpar(TELEFONE);
    expect(await gateway.obter(TELEFONE)).toEqual({ ok: true, value: null });
  });

  it("não guarda o telefone em claro", async () => {
    await gateway.salvar(TELEFONE, { etapa: "tipo_documento" });
    const { data } = await admin.from("atendimento_sessoes").select("*");
    expect(JSON.stringify(data)).not.toContain(TELEFONE);
  });

  it("sessão com mais de 10 min conta como inexistente e é varrida na próxima gravação", async () => {
    await gateway.salvar(TELEFONE, { etapa: "tipo_documento" });
    await admin
      .from("atendimento_sessoes")
      .update({ atualizado_em: new Date(Date.now() - 11 * 60 * 1000).toISOString() })
      .neq("chave", "");
    expect(await gateway.obter(TELEFONE)).toEqual({ ok: true, value: null });

    await gateway.salvar("61900001111", { etapa: "tipo_documento" });
    const { data } = await admin.from("atendimento_sessoes").select("chave");
    expect(data).toHaveLength(1);
  });

  it("usuário comum (anon) não lê a tabela", async () => {
    await gateway.salvar(TELEFONE, { etapa: "tipo_documento" });
    const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    const { data } = await anon.from("atendimento_sessoes").select("*");
    expect(data ?? []).toHaveLength(0);
  });
});
