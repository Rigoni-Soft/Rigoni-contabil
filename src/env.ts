import "server-only";

import { z } from "zod";

import { SEGREDOS_MENSAGERIA_PLACEHOLDER } from "@/main/segredos-mensageria.factory";

export * from "./env.client";

const emProductionDaVercel = process.env.VERCEL_ENV === "production";
const CNPJ_ALFANUMERICO = /^[0-9A-Z]{14}$/;
const TELEFONE_COM_DDI_SO_DIGITOS = /^[1-9]\d{9,14}$/;
const TAMANHO_MINIMO_DO_SEGREDO_E2E = 16;

const resultado = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    OBRIGACOES_FISCAIS_URL: z.url().default("http://127.0.0.1:4010"),
    OBRIGACOES_FISCAIS_MODO: z.enum(["mock", "serpro"]).default("mock"),
    SERPRO_AMBIENTE: z.enum(["trial", "producao"]).default("trial"),
    SERPRO_URL_AUTENTICACAO: z.url().optional(),
    SERPRO_URL_INTEGRA_CONTADOR: z.url().optional(),
    SERPRO_URL_CND_TOKEN: z.url().optional(),
    SERPRO_URL_CND_CERTIDAO: z.url().optional(),
    SERPRO_TOKEN_TRIAL: z.string().min(1).optional(),
    SERPRO_CONSUMER_KEY: z.string().min(1).optional(),
    SERPRO_CONSUMER_SECRET: z.string().min(1).optional(),
    SERPRO_CERTIFICADO_P12_BASE64: z.string().min(1).optional(),
    SERPRO_CERTIFICADO_SENHA: z.string().min(1).optional(),
    SERPRO_CNPJ_ESCRITORIO: z.string().regex(CNPJ_ALFANUMERICO).optional(),
    CND_MODO: z.enum(["mock", "serpro"]).default("mock"),
    SERPRO_CND_CONSUMER_KEY: z.string().min(1).optional(),
    SERPRO_CND_CONSUMER_SECRET: z.string().min(1).optional(),
    SERPRO_CND_CODIGO_IDENTIFICACAO: z.string().min(1).optional(),
    MENSAGERIA_MODO: z.enum(["falso", "real"]).default("falso"),
    MENSAGERIA_SEGREDO_ASSINATURA: z
      .string()
      .min(1)
      .default(SEGREDOS_MENSAGERIA_PLACEHOLDER.assinatura),
    MENSAGERIA_TOKEN_VERIFICACAO: z
      .string()
      .min(1)
      .default(SEGREDOS_MENSAGERIA_PLACEHOLDER.tokenVerificacao),
    MENSAGERIA_SEGREDO_SESSAO: z.string().min(1).default(SEGREDOS_MENSAGERIA_PLACEHOLDER.sessao),
    E2E_ADAPTER_SECRET: z.string().min(TAMANHO_MINIMO_DO_SEGREDO_E2E).optional(),
    WHATSAPP_TOKEN: z.string().min(1).optional(),
    WHATSAPP_PHONE_NUMBER_ID: z.string().min(1).optional(),
    CRON_SECRET: z.string().min(1).optional(),
    ENCERRAMENTO_AUTOMATICO: z.enum(["desligada", "ligada"]).default("desligada"),
    FFMPEG_PATH: z.string().min(1).optional(),
    LEMBRETES_AUTOMATICOS: z.enum(["desligada", "ligada"]).default("desligada"),
    LEMBRETES_PGFN_AUTOMATICOS: z.enum(["desligada", "ligada"]).default("desligada"),
    EMAIL_MODO: z.enum(["falso", "real"]).default("falso"),
    EMAIL_SMTP_USUARIO: z.string().min(1).optional(),
    EMAIL_SMTP_SENHA: z.string().min(1).optional(),
    EMAIL_REMETENTE: z.string().min(1).optional(),
    LEITURA_PDF_MODO: z.enum(["falso", "texto"]).default("falso"),
    EXTRACAO_CONVENCAO_MODO: z.enum(["falso", "indisponivel"]).default("falso"),
    LEITURA_CARTAO_MODO: z.enum(["falso", "indisponivel", "visao"]).default("falso"),
    ANTHROPIC_API_KEY: z.string().min(1).optional(),
    LEITURA_CARTAO_MODELO: z.string().min(1).default("claude-haiku-5-5"),
    FINANCEIRO_TELEFONE: z.string().regex(TELEFONE_COM_DDI_SO_DIGITOS).optional().catch(undefined),
  })
  .refine(
    (v) =>
      v.EMAIL_MODO !== "real" || (v.EMAIL_SMTP_USUARIO && v.EMAIL_SMTP_SENHA && v.EMAIL_REMETENTE),
    {
      message: "EMAIL_MODO=real exige EMAIL_SMTP_USUARIO, EMAIL_SMTP_SENHA e EMAIL_REMETENTE.",
      path: ["EMAIL_MODO"],
    },
  )
  .refine((v) => v.MENSAGERIA_MODO !== "real" || (v.WHATSAPP_TOKEN && v.WHATSAPP_PHONE_NUMBER_ID), {
    message: "MENSAGERIA_MODO=real exige WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID.",
    path: ["WHATSAPP_TOKEN"],
  })
  .refine((v) => v.LEITURA_CARTAO_MODO !== "visao" || v.ANTHROPIC_API_KEY, {
    message: "LEITURA_CARTAO_MODO=visao exige ANTHROPIC_API_KEY.",
    path: ["ANTHROPIC_API_KEY"],
  })
  .refine(
    (v) => {
      if (v.OBRIGACOES_FISCAIS_MODO !== "serpro") return true;
      const temCredencialDeProducao =
        v.SERPRO_CONSUMER_KEY &&
        v.SERPRO_CONSUMER_SECRET &&
        v.SERPRO_CERTIFICADO_P12_BASE64 &&
        v.SERPRO_CERTIFICADO_SENHA;
      return v.SERPRO_CNPJ_ESCRITORIO && (v.SERPRO_AMBIENTE === "trial" || temCredencialDeProducao);
    },
    {
      message:
        "OBRIGACOES_FISCAIS_MODO=serpro exige SERPRO_CNPJ_ESCRITORIO e, com SERPRO_AMBIENTE=producao, também SERPRO_CONSUMER_KEY, SERPRO_CONSUMER_SECRET, SERPRO_CERTIFICADO_P12_BASE64 e SERPRO_CERTIFICADO_SENHA.",
      path: ["OBRIGACOES_FISCAIS_MODO"],
    },
  )
  .refine(
    (v) =>
      v.CND_MODO !== "serpro" ||
      v.SERPRO_AMBIENTE === "trial" ||
      (v.SERPRO_CND_CONSUMER_KEY &&
        v.SERPRO_CND_CONSUMER_SECRET &&
        v.SERPRO_CND_CODIGO_IDENTIFICACAO),
    {
      message:
        "CND_MODO=serpro com SERPRO_AMBIENTE=producao exige SERPRO_CND_CONSUMER_KEY, SERPRO_CND_CONSUMER_SECRET e SERPRO_CND_CODIGO_IDENTIFICACAO.",
      path: ["CND_MODO"],
    },
  )
  .refine(
    (v) =>
      !emProductionDaVercel ||
      v.SERPRO_AMBIENTE === "producao" ||
      (v.OBRIGACOES_FISCAIS_MODO !== "serpro" && v.CND_MODO !== "serpro"),
    {
      message: "Production da Vercel não pode usar SERPRO_AMBIENTE=trial.",
      path: ["SERPRO_AMBIENTE"],
    },
  )
  .refine((v) => !emProductionDaVercel || v.LEITURA_CARTAO_MODO !== "falso", {
    message: "Production da Vercel não pode usar LEITURA_CARTAO_MODO=falso.",
    path: ["LEITURA_CARTAO_MODO"],
  })
  .refine((v) => !emProductionDaVercel || v.EXTRACAO_CONVENCAO_MODO !== "falso", {
    message: "Production da Vercel não pode usar EXTRACAO_CONVENCAO_MODO=falso.",
    path: ["EXTRACAO_CONVENCAO_MODO"],
  })
  .refine((v) => !emProductionDaVercel || !v.E2E_ADAPTER_SECRET, {
    message: "Production da Vercel não pode definir E2E_ADAPTER_SECRET.",
    path: ["E2E_ADAPTER_SECRET"],
  })
  .safeParse({
    NODE_ENV: process.env.NODE_ENV || undefined,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    OBRIGACOES_FISCAIS_URL: process.env.OBRIGACOES_FISCAIS_URL || undefined,
    OBRIGACOES_FISCAIS_MODO: process.env.OBRIGACOES_FISCAIS_MODO || undefined,
    SERPRO_AMBIENTE: process.env.SERPRO_AMBIENTE || undefined,
    SERPRO_URL_AUTENTICACAO: process.env.SERPRO_URL_AUTENTICACAO || undefined,
    SERPRO_URL_INTEGRA_CONTADOR: process.env.SERPRO_URL_INTEGRA_CONTADOR || undefined,
    SERPRO_URL_CND_TOKEN: process.env.SERPRO_URL_CND_TOKEN || undefined,
    SERPRO_URL_CND_CERTIDAO: process.env.SERPRO_URL_CND_CERTIDAO || undefined,
    SERPRO_TOKEN_TRIAL: process.env.SERPRO_TOKEN_TRIAL || undefined,
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
    E2E_ADAPTER_SECRET: process.env.E2E_ADAPTER_SECRET || undefined,
    WHATSAPP_TOKEN: process.env.WHATSAPP_TOKEN || undefined,
    WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID || undefined,
    CRON_SECRET: process.env.CRON_SECRET || undefined,
    ENCERRAMENTO_AUTOMATICO: process.env.ENCERRAMENTO_AUTOMATICO || undefined,
    FFMPEG_PATH: process.env.FFMPEG_PATH || undefined,
    LEMBRETES_AUTOMATICOS: process.env.LEMBRETES_AUTOMATICOS || undefined,
    LEMBRETES_PGFN_AUTOMATICOS: process.env.LEMBRETES_PGFN_AUTOMATICOS || undefined,
    EMAIL_MODO: process.env.EMAIL_MODO || undefined,
    EMAIL_SMTP_USUARIO: process.env.EMAIL_SMTP_USUARIO || undefined,
    EMAIL_SMTP_SENHA: process.env.EMAIL_SMTP_SENHA || undefined,
    EMAIL_REMETENTE: process.env.EMAIL_REMETENTE || undefined,
    LEITURA_PDF_MODO: process.env.LEITURA_PDF_MODO || undefined,
    EXTRACAO_CONVENCAO_MODO: process.env.EXTRACAO_CONVENCAO_MODO || undefined,
    LEITURA_CARTAO_MODO: process.env.LEITURA_CARTAO_MODO || undefined,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || undefined,
    LEITURA_CARTAO_MODELO: process.env.LEITURA_CARTAO_MODELO || undefined,
    FINANCEIRO_TELEFONE: process.env.FINANCEIRO_TELEFONE || undefined,
  });

if (!resultado.success) {
  throw new Error(`Variáveis de ambiente inválidas:\n${z.prettifyError(resultado.error)}`);
}

export const {
  NODE_ENV,
  SUPABASE_SERVICE_ROLE_KEY,
  OBRIGACOES_FISCAIS_URL,
  OBRIGACOES_FISCAIS_MODO,
  SERPRO_AMBIENTE,
  SERPRO_URL_AUTENTICACAO,
  SERPRO_URL_INTEGRA_CONTADOR,
  SERPRO_URL_CND_TOKEN,
  SERPRO_URL_CND_CERTIDAO,
  SERPRO_TOKEN_TRIAL,
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
  E2E_ADAPTER_SECRET,
  WHATSAPP_TOKEN,
  WHATSAPP_PHONE_NUMBER_ID,
  CRON_SECRET,
  ENCERRAMENTO_AUTOMATICO,
  FFMPEG_PATH,
  LEMBRETES_AUTOMATICOS,
  LEMBRETES_PGFN_AUTOMATICOS,
  EMAIL_MODO,
  EMAIL_SMTP_USUARIO,
  EMAIL_SMTP_SENHA,
  EMAIL_REMETENTE,
  LEITURA_PDF_MODO,
  EXTRACAO_CONVENCAO_MODO,
  LEITURA_CARTAO_MODO,
  ANTHROPIC_API_KEY,
  LEITURA_CARTAO_MODELO,
  FINANCEIRO_TELEFONE,
} = resultado.data;
