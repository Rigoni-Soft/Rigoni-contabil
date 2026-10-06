// Os testes de integração criam Clientes com CNPJs fixos e não limpam depois: sem isto, a
// segunda execução sem `supabase db reset` falha com "CNPJ já cadastrado". Apaga tudo o que
// não é Cliente do seed (CNPJs 9000000xxxxxxx); as tabelas filhas caem em cascata.
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

export default async function limparClientesDeTeste() {
  const admin = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });
  try {
    await admin.from("atendimentos").delete().not("cliente_id", "is", null);
    await admin.from("clientes").delete().not("cnpj", "like", "9000000%");
  } catch {
    // Supabase local fora do ar: os testes de integração falham sozinhos, com mensagem própria.
  }
}
