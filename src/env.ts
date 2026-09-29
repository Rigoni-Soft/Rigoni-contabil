import "server-only";

import { z } from "zod";

// PORT não entra aqui: nenhum código do app a lê (é consumida só por `next
// dev`/`next start` e pelo baseURL do Playwright, direto de process.env) —
// validá-la como obrigatória faria o app inteiro depender dela sem motivo,
// inclusive em build/deploy onde a plataforma controla a porta sozinha.
const resultado = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  })
  .safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

if (!resultado.success) {
  throw new Error(`Variáveis de ambiente inválidas:\n${z.prettifyError(resultado.error)}`);
}

export const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = resultado.data;
