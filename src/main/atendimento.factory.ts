import "server-only";

import {
  MENSAGERIA_MODO,
  MENSAGERIA_SEGREDO_ASSINATURA,
  MENSAGERIA_TOKEN_VERIFICACAO,
} from "@/env";

import { createSupabaseAdmin } from "@/main/supabase-admin.factory";
import type { ReceberMensagemPort } from "@/modules/atendimento/application/ports/in/receber-mensagem.provider";
import type { AutenticacaoWebhookPort } from "@/modules/atendimento/application/ports/out/autenticacao-webhook.provider";
import type { EnvioMensagemPort } from "@/modules/atendimento/application/ports/out/envio-mensagem.provider";
import { ReceberMensagem } from "@/modules/atendimento/application/use-cases/receber-mensagem.use-case";
import { EnvioMensagemFalsoGateway } from "@/modules/atendimento/infra/gateways/envio-mensagem-falso.gateway";
import { HmacAutenticacaoWebhookGateway } from "@/modules/atendimento/infra/gateways/hmac-autenticacao-webhook.gateway";
import { SupabaseDocumentosContratuaisGateway } from "@/modules/atendimento/infra/gateways/supabase-documentos-contratuais.gateway";
import { SupabaseIdentificacaoContatoGateway } from "@/modules/atendimento/infra/gateways/supabase-identificacao-contato.gateway";

// Instância única: o falso guarda em memória o que "enviou".
const envioFalso = new EnvioMensagemFalsoGateway();

function makeEnvioMensagem(): EnvioMensagemPort {
  if (MENSAGERIA_MODO === "real") {
    throw new Error("MENSAGERIA_MODO=real: o adapter real de mensageria ainda não existe (#68).");
  }
  return envioFalso;
}

export function makeReceberMensagem(): ReceberMensagemPort {
  const supabaseAdmin = createSupabaseAdmin();
  return new ReceberMensagem(
    new SupabaseIdentificacaoContatoGateway(supabaseAdmin),
    makeEnvioMensagem(),
    new SupabaseDocumentosContratuaisGateway(supabaseAdmin),
  );
}

export function makeAutenticacaoWebhook(): AutenticacaoWebhookPort {
  return new HmacAutenticacaoWebhookGateway(
    MENSAGERIA_SEGREDO_ASSINATURA,
    MENSAGERIA_TOKEN_VERIFICACAO,
  );
}
