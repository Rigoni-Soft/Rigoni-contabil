import "server-only";

import {
  MENSAGERIA_MODO,
  MENSAGERIA_SEGREDO_ASSINATURA,
  MENSAGERIA_SEGREDO_SESSAO,
  MENSAGERIA_TOKEN_VERIFICACAO,
} from "@/env";

import { exigirSegredosReais } from "@/main/segredos-mensageria.factory";
import { createSupabaseAdmin } from "@/main/supabase-admin.factory";
import type { AbrirAtendimentoPort } from "@/modules/atendimento/application/ports/in/abrir-atendimento.provider";
import type { ReceberMensagemPort } from "@/modules/atendimento/application/ports/in/receber-mensagem.provider";
import type { AutenticacaoWebhookPort } from "@/modules/atendimento/application/ports/out/autenticacao-webhook.provider";
import type { EnvioMensagemPort } from "@/modules/atendimento/application/ports/out/envio-mensagem.provider";
import { AbrirAtendimento } from "@/modules/atendimento/application/use-cases/abrir-atendimento.use-case";
import { ReceberMensagem } from "@/modules/atendimento/application/use-cases/receber-mensagem.use-case";
import { EnvioMensagemFalsoGateway } from "@/modules/atendimento/infra/gateways/envio-mensagem-falso.gateway";
import { HmacAutenticacaoWebhookGateway } from "@/modules/atendimento/infra/gateways/hmac-autenticacao-webhook.gateway";
import { SupabaseDocumentosContratuaisGateway } from "@/modules/atendimento/infra/gateways/supabase-documentos-contratuais.gateway";
import { SupabaseIdentificacaoContatoGateway } from "@/modules/atendimento/infra/gateways/supabase-identificacao-contato.gateway";
import { SupabaseSessaoAtendimentoGateway } from "@/modules/atendimento/infra/gateways/supabase-sessao-atendimento.gateway";
import { SupabaseAtendimentoRepository } from "@/modules/atendimento/infra/repositories/atendimento.repository";

// Instância única: o falso guarda em memória o que "enviou".
const envioFalso = new EnvioMensagemFalsoGateway();

function makeEnvioMensagem(): EnvioMensagemPort {
  if (MENSAGERIA_MODO === "real") {
    throw new Error("MENSAGERIA_MODO=real: o adapter real de mensageria ainda não existe (#68).");
  }
  return envioFalso;
}

// Chamada por makeAutenticacaoWebhook e makeReceberMensagem: nenhum caminho da rota pública
// (GET/POST) chega ao client privilegiado nem valida HMAC com segredo de desenvolvimento.
function exigirSegredosDeProducao(): void {
  exigirSegredosReais(
    {
      assinatura: MENSAGERIA_SEGREDO_ASSINATURA,
      tokenVerificacao: MENSAGERIA_TOKEN_VERIFICACAO,
      sessao: MENSAGERIA_SEGREDO_SESSAO,
    },
    process.env.NODE_ENV === "production",
  );
}

export function makeAbrirAtendimento(): AbrirAtendimentoPort {
  return new AbrirAtendimento(new SupabaseAtendimentoRepository(createSupabaseAdmin()));
}

export function makeReceberMensagem(): ReceberMensagemPort {
  exigirSegredosDeProducao();
  const supabaseAdmin = createSupabaseAdmin();
  return new ReceberMensagem(
    new SupabaseIdentificacaoContatoGateway(supabaseAdmin),
    makeEnvioMensagem(),
    new SupabaseDocumentosContratuaisGateway(supabaseAdmin),
    new SupabaseSessaoAtendimentoGateway(supabaseAdmin, MENSAGERIA_SEGREDO_SESSAO),
    makeAbrirAtendimento(),
  );
}

export function makeAutenticacaoWebhook(): AutenticacaoWebhookPort {
  exigirSegredosDeProducao();
  return new HmacAutenticacaoWebhookGateway(
    MENSAGERIA_SEGREDO_ASSINATURA,
    MENSAGERIA_TOKEN_VERIFICACAO,
  );
}
