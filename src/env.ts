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
    // Fonte das obrigações fiscais (docs/contratos): por padrão o mock de mock-api/.
    OBRIGACOES_FISCAIS_URL: z.url().default("http://127.0.0.1:4010"),
    // Adapter de mensageria (docs/contratos/mensageria.md): falso por padrão.
    MENSAGERIA_MODO: z.enum(["falso", "real"]).default("falso"),
    // Segredos do webhook (assinatura HMAC e handshake de verificação). Valores
    // falsos de dev; em produção vêm do painel do provedor.
    MENSAGERIA_SEGREDO_ASSINATURA: z.string().min(1).default("segredo-falso"),
    MENSAGERIA_TOKEN_VERIFICACAO: z.string().min(1).default("token-falso"),
  })
  .safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    OBRIGACOES_FISCAIS_URL: process.env.OBRIGACOES_FISCAIS_URL || undefined,
    MENSAGERIA_MODO: process.env.MENSAGERIA_MODO || undefined,
    MENSAGERIA_SEGREDO_ASSINATURA: process.env.MENSAGERIA_SEGREDO_ASSINATURA || undefined,
    MENSAGERIA_TOKEN_VERIFICACAO: process.env.MENSAGERIA_TOKEN_VERIFICACAO || undefined,
  });

if (!resultado.success) {
  throw new Error(`Variáveis de ambiente inválidas:\n${z.prettifyError(resultado.error)}`);
}

export const {
  SUPABASE_SERVICE_ROLE_KEY,
  OBRIGACOES_FISCAIS_URL,
  MENSAGERIA_MODO,
  MENSAGERIA_SEGREDO_ASSINATURA,
  MENSAGERIA_TOKEN_VERIFICACAO,
} = resultado.data;
