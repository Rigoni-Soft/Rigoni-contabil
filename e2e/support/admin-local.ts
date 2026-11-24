import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { exigirDestinoDoE2E } from "../../test-support/exigir-supabase-local";

const SERVICE_KEY_LOCAL =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

export async function limparEsperaSemDonoDoSetor(admin: SupabaseClient, setor: string) {
  await admin.from("atendimentos").delete().eq("setor", setor).is("funcionario_id", null);
}

export function adminLocal(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
  exigirDestinoDoE2E(url, {
    baseUrl: process.env.BASE_URL,
    refHomolog: process.env.SUPABASE_HOMOLOG_PROJECT_REF,
  });
  return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY ?? SERVICE_KEY_LOCAL, {
    auth: { persistSession: false },
  });
}
