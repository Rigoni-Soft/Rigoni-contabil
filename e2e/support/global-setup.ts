import { createClient } from "@supabase/supabase-js";

// Os e2e cadastram Clientes "… E2E …" e nunca os apagam: na rodada seguinte os CNPJs fixos
// colidem e a busca devolve nomes repetidos. Limpa os restos antes da suíte (só no Supabase local).
export default async function globalSetup() {
  if (process.env.BASE_URL) return;
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
    { auth: { persistSession: false } },
  );
  const { error } = await admin.from("clientes").delete().ilike("empresa", "%E2E%");
  if (error) throw error;
}
