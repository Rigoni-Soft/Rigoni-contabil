/**
 * Fronteira de acesso do papel `anon` (arquitetura.md, 3.12 e 3.14): o sistema não tem acesso
 * anônimo, então a chave pública não alcança nenhuma tabela nem RPC do schema public, mesmo antes
 * do RLS. Só leitura/tentativa: não escreve nada. Requer `npx supabase start` local.
 */
import { createClient } from "@supabase/supabase-js";

import { exigirSupabaseLocal } from "../../../../../test-support/exigir-supabase-local";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

exigirSupabaseLocal(SUPABASE_URL);

const anonimo = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });

// Permission denied do Postgres (42501), não "lista vazia pelo RLS".
const NEGADO = "42501";

const TABELAS = [
  "perfis",
  "registros_auditoria",
  "clientes",
  "clientes_basico",
  "cliente_alteracoes_contratuais",
  "cliente_cadastro_operacional_sn",
  "cliente_contatos",
  "cliente_atividades_mensais",
  "atendimento_sessoes",
  "atendimentos",
  "mensagens",
  "transferencias",
  "assuncoes_atendimento",
  "feriados",
  "anexos_em_envio",
];

describe("papel anon sem privilégio no schema public", () => {
  it.each(TABELAS)("%s: leitura negada pelo privilégio, não pelo RLS", async (tabela) => {
    const { data, error } = await anonimo.from(tabela).select("*").limit(1);

    expect(error?.code).toBe(NEGADO);
    expect(data).toBeNull();
  });

  it("escrita em perfis é negada pelo privilégio", async () => {
    const { error } = await anonimo.from("perfis").insert({
      id: crypto.randomUUID(),
      nome: "x",
      email: "x@x.test",
      papel: "admin",
      setor: "administrativo",
    });

    expect(error?.code).toBe(NEGADO);
  });

  it.each([
    [
      "criar_cliente",
      {
        p_id: crypto.randomUUID(),
        p_empresa: "x",
        p_cnpj: "1",
        p_regime: "mei",
        p_contrato_social_caminho: null,
        p_alteracoes: [],
      },
    ],
    ["meu_papel", {}],
    ["acesso_liberado", {}],
    ["registrar_acao_auditoria", {}],
    ["abrir_atendimento", {}],
    ["desativar_usuario", {}],
  ])("RPC %s: execução negada", async (nome, args) => {
    const { error } = await anonimo.rpc(nome, args);

    // 42501 (sem privilégio) ou PGRST202 (a função não está exposta a esse papel): nunca sucesso.
    expect(["42501", "PGRST202"]).toContain(error?.code);
  });
});
