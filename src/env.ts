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
    // Ambiente do Serpro: "trial" (demonstração: token fixo, sem certificado; Preview/homolog) ou
    // "producao" (OAuth2 + e-CNPJ; Production). Define as URLs padrão; cada uma é sobrescrevível.
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
    // Segredo que os e2e mandam no cabeçalho para usar o adapter falso num deploy com mensageria real
    // (ver pedeAdapterFalsoDoE2E). Só no Preview/homolog; Production da Vercel recusa (refine abaixo).
    E2E_ADAPTER_SECRET: z.string().min(16).optional(),
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
    // Adapter de e-mail (#86): falso por padrão. Com "real": SMTP do Gmail com senha de app (a conta
    // precisa de verificação em duas etapas) e o `from`, ex.: "Rigoni Contábil <conta@gmail.com>".
    EMAIL_MODO: z.enum(["falso", "real"]).default("falso"),
    EMAIL_SMTP_USUARIO: z.string().min(1).optional(),
    EMAIL_SMTP_SENHA: z.string().min(1).optional(),
    EMAIL_REMETENTE: z.string().min(1).optional(),
    // Leitor do PDF de parcelamento: falso (determinístico, padrão em dev/CI/Preview) ou "texto" (lê a
    // camada de texto do PDF no servidor, sem API externa).
    LEITURA_PDF_MODO: z.enum(["falso", "texto"]).default("falso"),
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
  .refine(
    (v) =>
      v.OBRIGACOES_FISCAIS_MODO !== "serpro" ||
      (v.SERPRO_CNPJ_ESCRITORIO &&
        (v.SERPRO_AMBIENTE === "trial" ||
          (v.SERPRO_CONSUMER_KEY &&
            v.SERPRO_CONSUMER_SECRET &&
            v.SERPRO_CERTIFICADO_P12_BASE64 &&
            v.SERPRO_CERTIFICADO_SENHA))),
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
  // Trial devolve dados de demonstração: em Production da Vercel isso "enviaria" guias falsas
  // a Clientes reais.
  .refine(
    (v) =>
      process.env.VERCEL_ENV !== "production" ||
      v.SERPRO_AMBIENTE === "producao" ||
      (v.OBRIGACOES_FISCAIS_MODO !== "serpro" && v.CND_MODO !== "serpro"),
    {
      message: "Production da Vercel não pode usar SERPRO_AMBIENTE=trial.",
      path: ["SERPRO_AMBIENTE"],
    },
  )
  .refine((v) => v.MENSAGERIA_MODO !== "real" || (v.WHATSAPP_TOKEN && v.WHATSAPP_PHONE_NUMBER_ID), {
    message: "MENSAGERIA_MODO=real exige WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID.",
    path: ["WHATSAPP_TOKEN"],
  })
  .refine((v) => process.env.VERCEL_ENV !== "production" || !v.E2E_ADAPTER_SECRET, {
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
    INATIVIDADE_AUTOMATICA: process.env.INATIVIDADE_AUTOMATICA || undefined,
    FFMPEG_PATH: process.env.FFMPEG_PATH || undefined,
    LEMBRETES_AUTOMATICOS: process.env.LEMBRETES_AUTOMATICOS || undefined,
    EMAIL_MODO: process.env.EMAIL_MODO || undefined,
    EMAIL_SMTP_USUARIO: process.env.EMAIL_SMTP_USUARIO || undefined,
    EMAIL_SMTP_SENHA: process.env.EMAIL_SMTP_SENHA || undefined,
    EMAIL_REMETENTE: process.env.EMAIL_REMETENTE || undefined,
    LEITURA_PDF_MODO: process.env.LEITURA_PDF_MODO || undefined,
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
  INATIVIDADE_AUTOMATICA,
  FFMPEG_PATH,
  LEMBRETES_AUTOMATICOS,
  EMAIL_MODO,
  EMAIL_SMTP_USUARIO,
  EMAIL_SMTP_SENHA,
  EMAIL_REMETENTE,
  LEITURA_PDF_MODO,
} = resultado.data;
