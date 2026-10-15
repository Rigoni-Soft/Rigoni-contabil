import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { exigirSupabaseLocal } from "../../test-support/exigir-supabase-local";

// Chave de serviço do Supabase local (supabase/.env.local, não é segredo).
const SERVICE_KEY_LOCAL =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

// Cliente administrativo das suítes e2e que preparam e apagam dados: recusa um destino que não seja
// o Supabase local ANTES de criar o client, em vez de limpar o que é de outros.
export function adminLocal(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
  exigirSupabaseLocal(url);
  return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY ?? SERVICE_KEY_LOCAL, {
    auth: { persistSession: false },
  });
}
