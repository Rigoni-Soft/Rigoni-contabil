import "server-only";

import { z } from "zod";

import { SEGREDOS_MENSAGERIA_PLACEHOLDER } from "@/main/segredos-mensageria.factory";

export * from "./env.client";

// PORT não entra aqui: nenhum código do app a lê (é consumida só por `next dev`/`next start` e pelo
// baseURL do Playwright, direto de process.env) — validá-la como obrigatória faria o app inteiro
// depender dela sem motivo, inclusive em build/deploy onde a plataforma controla a porta sozinha.
const resultado = z
  .object({
    // O Next define NODE_ENV (production no build e na Vercel, inclusive preview). As regras que
    // dependem de "produção" (segredos reais, jobs só com mensageria real) leem daqui, não de
    // process.env.
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    // Fonte das obrigações fiscais (docs/contratos): por padrão o mock de mock-api/.
    OBRIGACOES_FISCAIS_URL: z.url().default("http://127.0.0.1:4010"),
    // Provedor das obrigações fiscais: o mock acima (padrão) ou o Serpro real (#66).
    OBRIGACOES_FISCAIS_MODO: z.enum(["mock", "serpro"]).default("mock"),
    // Só com OBRIGACOES_FISCAIS_MODO=serpro: credenciais do contrato (Consumer Key/Secret) e
    // certificado e-CNPJ do escritório (.p12 em base64, pois a Vercel não tem arquivos) + senha.
    SERPRO_CONSUMER_KEY: z.string().min(1).optional(),
    SERPRO_CONSUMER_SECRET: z.string().min(1).optional(),
    SERPRO_CERTIFICADO_P12_BASE64: z.string().min(1).optional(),
    SERPRO_CERTIFICADO_SENHA: z.string().min(1).optional(),
    SERPRO_CNPJ_ESCRITORIO: z
      .string()
      .regex(/^[0-9A-Z]{14}$/)
      .optional(),
    // CND (outro produto do Serpro, chave própria, sem certificado): mesmo esquema, modo à parte.
    CND_MODO: z.enum(["mock", "serpro"]).default("mock"),
    SERPRO_CND_CONSUMER_KEY: z.string().min(1).optional(),
    SERPRO_CND_CONSUMER_SECRET: z.string().min(1).optional(),
    SERPRO_CND_CODIGO_IDENTIFICACAO: z.string().min(1).optional(),
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
    // Credenciais da Cloud API (Meta); só exigidas com MENSAGERIA_MODO=real (a factory valida).
    WHATSAPP_TOKEN: z.string().min(1).optional(),
    WHATSAPP_PHONE_NUMBER_ID: z.string().min(1).optional(),
    // Bearer das rotas de job (agendador). Sem valor, as rotas recusam tudo.
    CRON_SECRET: z.string().min(1).optional(),
    // Liga o encerramento automático por inatividade. Desligada por padrão: ter o CRON_SECRET não
    // basta. Em produção só age com mensageria real e o aviso visível ao Funcionário
    // (docs/contratos/mensageria.md).
    INATIVIDADE_AUTOMATICA: z.enum(["desligada", "ligada"]).default("desligada"),
    // Binário do ffmpeg que converte o áudio gravado em webm (docs/adr/0006). Sem valor, usa o
    // do pacote `ffmpeg-static`.
    FFMPEG_PATH: z.string().min(1).optional(),
    // Liga o job de lembrete de documento e envio de DAS. Mesma regra da inatividade.
    LEMBRETES_AUTOMATICOS: z.enum(["desligada", "ligada"]).default("desligada"),
  })
  .refine((v) => v.MENSAGERIA_MODO !== "real" || (v.WHATSAPP_TOKEN && v.WHATSAPP_PHONE_NUMBER_ID), {
    message: "MENSAGERIA_MODO=real exige WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID.",
    path: ["WHATSAPP_TOKEN"],
  })
  .refine(
    (v) =>
      v.OBRIGACOES_FISCAIS_MODO !== "serpro" ||
      (v.SERPRO_CONSUMER_KEY &&
        v.SERPRO_CONSUMER_SECRET &&
        v.SERPRO_CERTIFICADO_P12_BASE64 &&
        v.SERPRO_CERTIFICADO_SENHA &&
        v.SERPRO_CNPJ_ESCRITORIO),
    {
      message:
        "OBRIGACOES_FISCAIS_MODO=serpro exige SERPRO_CONSUMER_KEY, SERPRO_CONSUMER_SECRET, SERPRO_CERTIFICADO_P12_BASE64, SERPRO_CERTIFICADO_SENHA e SERPRO_CNPJ_ESCRITORIO.",
      path: ["OBRIGACOES_FISCAIS_MODO"],
    },
  )
  .refine(
    (v) =>
      v.CND_MODO !== "serpro" ||
      (v.SERPRO_CND_CONSUMER_KEY &&
        v.SERPRO_CND_CONSUMER_SECRET &&
        v.SERPRO_CND_CODIGO_IDENTIFICACAO),
    {
      message:
        "CND_MODO=serpro exige SERPRO_CND_CONSUMER_KEY, SERPRO_CND_CONSUMER_SECRET e SERPRO_CND_CODIGO_IDENTIFICACAO.",
      path: ["CND_MODO"],
    },
  )
  .safeParse({
    NODE_ENV: process.env.NODE_ENV || undefined,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    OBRIGACOES_FISCAIS_URL: process.env.OBRIGACOES_FISCAIS_URL || undefined,
    OBRIGACOES_FISCAIS_MODO: process.env.OBRIGACOES_FISCAIS_MODO || undefined,
    SERPRO_CONSUMER_KEY: process.env.SERPRO_CONSUMER_KEY || undefined,
    SERPRO_CONSUMER_SECRET: process.env.SERPRO_CONSUMER_SECRET || undefined,
    SERPRO_CERTIFICADO_P12_BASE64: process.env.SERPRO_CERTIFICADO_P12_BASE64 || undefined,
    SERPRO_CERTIFICADO_SENHA: process.env.SERPRO_CERTIFICADO_SENHA || undefined,
    SERPRO_CNPJ_ESCRITORIO: process.env.SERPRO_CNPJ_ESCRITORIO || undefined,
    CND_MODO: process.env.CND_MODO || undefined,
    SERPRO_CND_CONSUMER_KEY: process.env.SERPRO_CND_CONSUMER_KEY || undefined,
    SERPRO_CND_CONSUMER_SECRET: process.env.SERPRO_CND_CONSUMER_SECRET || undefined,
    SERPRO_CND_CODIGO_IDENTIFICACAO: process.env.SERPRO_CND_CODIGO_IDENTIFICACAO || undefined,
    MENSAGERIA_MODO: process.env.MENSAGERIA_MODO || undefined,
    MENSAGERIA_SEGREDO_ASSINATURA: process.env.MENSAGERIA_SEGREDO_ASSINATURA || undefined,
    MENSAGERIA_TOKEN_VERIFICACAO: process.env.MENSAGERIA_TOKEN_VERIFICACAO || undefined,
    MENSAGERIA_SEGREDO_SESSAO: process.env.MENSAGERIA_SEGREDO_SESSAO || undefined,
    WHATSAPP_TOKEN: process.env.WHATSAPP_TOKEN || undefined,
    WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID || undefined,
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
  OBRIGACOES_FISCAIS_MODO,
  SERPRO_CONSUMER_KEY,
  SERPRO_CONSUMER_SECRET,
  SERPRO_CERTIFICADO_P12_BASE64,
  SERPRO_CERTIFICADO_SENHA,
  SERPRO_CNPJ_ESCRITORIO,
  CND_MODO,
  SERPRO_CND_CONSUMER_KEY,
  SERPRO_CND_CONSUMER_SECRET,
  SERPRO_CND_CODIGO_IDENTIFICACAO,
  MENSAGERIA_MODO,
  MENSAGERIA_SEGREDO_ASSINATURA,
  MENSAGERIA_TOKEN_VERIFICACAO,
  MENSAGERIA_SEGREDO_SESSAO,
  WHATSAPP_TOKEN,
  WHATSAPP_PHONE_NUMBER_ID,
  CRON_SECRET,
  INATIVIDADE_AUTOMATICA,
  FFMPEG_PATH,
  LEMBRETES_AUTOMATICOS,
} = resultado.data;
