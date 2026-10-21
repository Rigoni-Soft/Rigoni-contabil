import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

// Cada suíte de integração que cria Cliente com CNPJ fixo declara a lista dos seus e chama esta
// função em `beforeAll` (sobra de uma execução interrompida) e em `afterAll`. Apaga SÓ esses CNPJs:
// nunca um DELETE amplo. Os CNPJs listados nas suítes são reservados para teste; as tabelas filhas
// caem em cascata.
export async function removerClientesDeTeste(cnpjs: readonly string[]): Promise<void> {
  // Mesmo com a lista fechada, só mexe no Supabase local.
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(`${SUPABASE_URL}/`)) {
    throw new Error("A limpeza de Clientes de teste só roda contra o Supabase local.");
  }
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  // Os eventos de auditoria desses Clientes (alvo = CNPJ) não caem em cascata; sem apagá-los, o teste
  // que conta "exatamente um evento" falha na execução seguinte.
  // O alvo pode ser o CNPJ puro ou "CNPJ - alteração nº N" (anexar alteração): apaga pelo prefixo.
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
