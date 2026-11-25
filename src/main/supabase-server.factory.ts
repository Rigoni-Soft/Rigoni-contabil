import "server-only";

import { cookies } from "next/headers";
import { NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_URL } from "@/env.client";
import { createServerClient } from "@supabase/ssr";

function ignorarEscritaDeCookieEmServerComponent(): void {}

export async function createSupabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesParaSetar) => {
        try {
          cookiesParaSetar.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          ignorarEscritaDeCookieEmServerComponent();
        }
      },
    },
  });
}
