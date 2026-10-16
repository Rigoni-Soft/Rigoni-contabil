import "server-only";

import { z } from "zod";

import { SEGREDOS_MENSAGERIA_PLACEHOLDER } from "@/main/segredos-mensageria.factory";

export * from "./env.client";

// PORT não entra aqui: nenhum código do app a lê (é consumida só por `next
// dev`/`next start` e pelo baseURL do Playwright, direto de process.env) —
// validá-la como obrigatória faria o app inteiro depender dela sem motivo,
// inclusive em build/deploy onde a plataforma controla a porta sozinha.
const resultado = z
  .object({
    // O Next define NODE_ENV (production no build e na Vercel, inclusive preview). As regras que
    // dependem de "produção" (segredos reais, jobs só com mensageria real) leem daqui, não de
    // process.env.
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    // Fonte das obrigações fiscais (docs/contratos): por padrão o mock de mock-api/.
    OBRIGACOES_FISCAIS_URL: z.url().default("http://127.0.0.1:4010"),
    // Adapter de mensageria (docs/contratos/mensageria.md): falso por padrão.
    MENSAGERIA_MODO: z.enum(["falso", "real"]).default("falso"),
    // Segredos do webhook (assinatura HMAC e handshake de verificação). Valores
    // falsos de dev; em produção vêm do painel do provedor (a factory recusa os falsos).
    MENSAGERIA_SEGREDO_ASSINATURA: z
      .string()
      .min(1)
      .default(SEGREDOS_MENSAGERIA_PLACEHOLDER.assinatura),
    MENSAGERIA_TOKEN_VERIFICACAO: z
      .string()
      .min(1)
      .default(SEGREDOS_MENSAGERIA_PLACEHOLDER.tokenVerificacao),
    // Chave do HMAC que pseudonimiza o telefone na sessão da URA. Própria (não reaproveita o
    // segredo do webhook): trocar um não invalida o outro. Valor falso só pra dev.
    MENSAGERIA_SEGREDO_SESSAO: z.string().min(1).default(SEGREDOS_MENSAGERIA_PLACEHOLDER.sessao),
    // Bearer das rotas de job (agendador). Sem valor, as rotas recusam tudo.
    CRON_SECRET: z.string().min(1).optional(),
    // Liga o encerramento automático por inatividade. Desligada por padrão: ter o CRON_SECRET não basta.
    // Em produção só age com mensageria real e o aviso visível ao Funcionário (docs/contratos/mensageria.md).
    INATIVIDADE_AUTOMATICA: z.enum(["desligada", "ligada"]).default("desligada"),
    // Binário do ffmpeg que converte o áudio gravado em webm (docs/adr/0006). Sem valor, usa o
    // do pacote `ffmpeg-static`.
    FFMPEG_PATH: z.string().min(1).optional(),
    // Liga o job de lembrete de documento e envio de DAS. Mesma regra da inatividade.
    LEMBRETES_AUTOMATICOS: z.enum(["desligada", "ligada"]).default("desligada"),
  })
  .safeParse({
    NODE_ENV: process.env.NODE_ENV || undefined,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    OBRIGACOES_FISCAIS_URL: process.env.OBRIGACOES_FISCAIS_URL || undefined,
    MENSAGERIA_MODO: process.env.MENSAGERIA_MODO || undefined,
    MENSAGERIA_SEGREDO_ASSINATURA: process.env.MENSAGERIA_SEGREDO_ASSINATURA || undefined,
    MENSAGERIA_TOKEN_VERIFICACAO: process.env.MENSAGERIA_TOKEN_VERIFICACAO || undefined,
    MENSAGERIA_SEGREDO_SESSAO: process.env.MENSAGERIA_SEGREDO_SESSAO || undefined,
    CRON_SECRET: process.env.CRON_SECRET || undefined,
    INATIVIDADE_AUTOMATICA: process.env.INATIVIDADE_AUTOMATICA || undefined,
    FFMPEG_PATH: process.env.FFMPEG_PATH || undefined,
    LEMBRETES_AUTOMATICOS: process.env.LEMBRETES_AUTOMATICOS || undefined,
  });

if (!resultado.success) {
  throw new Error(`Variáveis de ambiente inválidas:\n${z.prettifyError(resultado.error)}`);
}

export const {
  NODE_ENV,
  SUPABASE_SERVICE_ROLE_KEY,
  OBRIGACOES_FISCAIS_URL,
  MENSAGERIA_MODO,
  MENSAGERIA_SEGREDO_ASSINATURA,
  MENSAGERIA_TOKEN_VERIFICACAO,
  MENSAGERIA_SEGREDO_SESSAO,
  CRON_SECRET,
  INATIVIDADE_AUTOMATICA,
  FFMPEG_PATH,
  LEMBRETES_AUTOMATICOS,
} = resultado.data;
