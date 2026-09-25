import "server-only";

import { z } from "zod";

export * from "./env.client";

// PORT não entra aqui: nenhum código do app a lê (é consumida só por `next
// dev`/`next start` e pelo baseURL do Playwright, direto de process.env) —
// validá-la como obrigatória faria o app inteiro depender dela sem motivo,
// inclusive em build/deploy onde a plataforma controla a porta sozinha
// (revisão do #28).
const resultado = z
  .object({
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  })
  .safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

if (!resultado.success) {
  throw new Error(`Variáveis de ambiente inválidas:\n${z.prettifyError(resultado.error)}`);
}

export const { SUPABASE_SERVICE_ROLE_KEY } = resultado.data;
