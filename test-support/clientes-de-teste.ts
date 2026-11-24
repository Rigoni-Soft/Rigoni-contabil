import { createClient } from "@supabase/supabase-js";

import { exigirSupabaseLocal } from "./exigir-supabase-local";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

export async function removerClientesDeTeste(cnpjs: readonly string[]): Promise<void> {
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(`${SUPABASE_URL}/`)) {
    throw new Error("A limpeza de Clientes de teste só roda contra o Supabase local.");
  }
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const eventos = await admin
    .from("registros_auditoria")
    .delete()
    .or(cnpjs.map((cnpj) => `alvo.like.${cnpj}*`).join(","));
  if (eventos.error)
    throw new Error(`Falha ao limpar a auditoria de teste: ${eventos.error.message}`);
  const clientes = await admin
    .from("clientes")
    .delete()
    .in("cnpj", [...cnpjs]);
  if (clientes.error)
    throw new Error(`Falha ao limpar Clientes de teste: ${clientes.error.message}`);
}

export async function criarClienteDeTeste(
  cnpj: string,
  regime: string,
  alteracoes: { numero: number; data: string }[] = [],
): Promise<string> {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const id = crypto.randomUUID();
  const { error } = await admin.rpc("criar_cliente", {
    p_id: id,
    p_empresa: "Cliente de Teste Ltda",
    p_cnpj: cnpj,
    p_regime: regime,
    p_contrato_social_caminho: `${id}/contrato-social/c.pdf`,
    p_alteracoes: alteracoes.map((a) => ({
      id: crypto.randomUUID(),
      numero: a.numero,
      data: a.data,
      arquivoCaminho: `${id}/alteracoes-contratuais/${a.numero}-a.pdf`,
    })),
  });
  if (error) throw new Error(`Falha ao criar Cliente de teste: ${error.message}`);
  return id;
}

export async function marcarAvisosComoVistos(): Promise<void> {
  exigirSupabaseLocal(SUPABASE_URL);
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { error } = await admin
    .from("avisos_cadastro")
    .update({ visto_em: new Date().toISOString() })
    .is("visto_em", null);
  if (error) throw new Error(`Falha ao zerar os Avisos de cadastro: ${error.message}`);
}
