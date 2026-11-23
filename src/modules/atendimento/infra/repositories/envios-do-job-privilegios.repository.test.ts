/**
 * Fronteira de acesso das RPCs que só o job de envio (service_role) chama: `anon` e `authenticated`
 * não têm EXECUTE (o baseline concede EXECUTE a authenticated por default privileges, então o REVOKE de
 * PUBLIC não basta). Só tentativa de leitura: não escreve nada. Requer `npx supabase start` local.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { exigirSupabaseLocal } from "../../../../../test-support/exigir-supabase-local";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

exigirSupabaseLocal(SUPABASE_URL);

const NEGADO = "42501";

const RPCS_DO_JOB: [string, Record<string, unknown>][] = [
  ["clientes_para_envio_base", {}],
  ["clientes_para_lembrete", {}],
  ["clientes_para_parcelamento", {}],
  [
    "destinos_de_envio_do_job",
    { p_cliente_id: crypto.randomUUID(), p_setor: "simples_nacional", p_tipo: "das" },
  ],
];

async function entrar(email: string, senha: string): Promise<SupabaseClient> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(`Falha ao autenticar ${email}: ${error.message}`);
  return supabase;
}

describe("RPCs do job de envio: só o service_role executa", () => {
  it.each(RPCS_DO_JOB)("%s: authenticated é negado pelo privilégio", async (nome, args) => {
    const funcionario = await entrar("funcionario.sn@rigonicontabil.local", "func123");

    const { error } = await funcionario.rpc(nome, args);

    expect(error?.code).toBe(NEGADO);
  });

  it.each(RPCS_DO_JOB)("%s: anon é negado pelo privilégio", async (nome, args) => {
    const anonimo = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });

    const { error } = await anonimo.rpc(nome, args);

    expect(["42501", "PGRST202"]).toContain(error?.code);
  });

  it.each(RPCS_DO_JOB)("%s: o service_role executa", async (nome, args) => {
    const servico = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { error } = await servico.rpc(nome, args);

    expect(error).toBeNull();
  });
});

// Escreve no sino (SECURITY DEFINER): só o service_role e o trigger a chamam. O teste só tenta como
// quem não pode, então nada é gravado.
describe("avisar_sem_meio_de_envio: quem não é service_role é negado", () => {
  const args = {
    p_cliente_id: crypto.randomUUID(),
    p_setor: "simples_nacional",
    p_mensagem: "x",
  };

  it("authenticated", async () => {
    const funcionario = await entrar("funcionario.sn@rigonicontabil.local", "func123");

    const { error } = await funcionario.rpc("avisar_sem_meio_de_envio", args);

    expect(error?.code).toBe(NEGADO);
  });

  it("anon", async () => {
    const anonimo = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });

    const { error } = await anonimo.rpc("avisar_sem_meio_de_envio", args);

    expect(["42501", "PGRST202"]).toContain(error?.code);
  });
});
