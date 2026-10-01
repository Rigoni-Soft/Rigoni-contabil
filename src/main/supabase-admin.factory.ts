import "server-only";

import { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "@/env";
import { createClient } from "@supabase/supabase-js";

// service_role: só aqui (docs/adr/0001). Nunca reexportar nem passar esse client
// adiante além do gateway que o consome.
export function createSupabaseAdmin() {
  return createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
