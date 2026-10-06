import "server-only";

import {
  MENSAGERIA_MODO,
  MENSAGERIA_SEGREDO_ASSINATURA,
  MENSAGERIA_SEGREDO_SESSAO,
  MENSAGERIA_TOKEN_VERIFICACAO,
} from "@/env";
import type { SupabaseClient } from "@supabase/supabase-js";

import { makeRegistrarAcao } from "@/main/auditoria.factory";
import { exigirSegredosReais } from "@/main/segredos-mensageria.factory";
import { createSupabaseAdmin } from "@/main/supabase-admin.factory";
import { createSupabaseServer } from "@/main/supabase-server.factory";
import type { ReceberMensagemPort } from "@/modules/atendimento/application/ports/in/receber-mensagem.provider";
import type { TransferirAtendimentoPort } from "@/modules/atendimento/application/ports/in/transferir-atendimento.provider";
import type { AuditoriaPort } from "@/modules/atendimento/application/ports/out/auditoria.provider";
import type { AutenticacaoWebhookPort } from "@/modules/atendimento/application/ports/out/autenticacao-webhook.provider";
import type { EnvioMensagemPort } from "@/modules/atendimento/application/ports/out/envio-mensagem.provider";
import type {
  AtorSessaoDto,
  SessaoPort,
} from "@/modules/atendimento/application/ports/out/sessao.provider";
import { AbrirAtendimento } from "@/modules/atendimento/application/use-cases/abrir-atendimento.use-case";
import { AnexarMensagemAtendimento } from "@/modules/atendimento/application/use-cases/anexar-mensagem-atendimento.use-case";
import { ReceberMensagem } from "@/modules/atendimento/application/use-cases/receber-mensagem.use-case";
import { TransferirAtendimento } from "@/modules/atendimento/application/use-cases/transferir-atendimento.use-case";
import { EnvioMensagemFalsoGateway } from "@/modules/atendimento/infra/gateways/envio-mensagem-falso.gateway";
import { HmacAutenticacaoWebhookGateway } from "@/modules/atendimento/infra/gateways/hmac-autenticacao-webhook.gateway";
import { SupabaseDocumentosContratuaisGateway } from "@/modules/atendimento/infra/gateways/supabase-documentos-contratuais.gateway";
import { SupabaseIdentificacaoContatoGateway } from "@/modules/atendimento/infra/gateways/supabase-identificacao-contato.gateway";
import { SupabaseSessaoAtendimentoGateway } from "@/modules/atendimento/infra/gateways/supabase-sessao-atendimento.gateway";
import { SupabaseAtendimentoRepository } from "@/modules/atendimento/infra/repositories/atendimento.repository";
import { ObterSessao } from "@/modules/usuarios/application/use-cases/obter-sessao.use-case";
import { SupabaseSessaoGateway } from "@/modules/usuarios/infra/gateways/supabase-sessao.gateway";
import { SupabaseUsuarioRepository } from "@/modules/usuarios/infra/repositories/usuario.repository";
import type { Papel } from "@/shared/kernel/papeis";
import type { SetorSlug } from "@/shared/kernel/setores";

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

export function makeReceberMensagem(): ReceberMensagemPort {
  exigirSegredosDeProducao();
  const supabaseAdmin = createSupabaseAdmin();
  const atendimentos = new SupabaseAtendimentoRepository(supabaseAdmin);
  return new ReceberMensagem(
    new SupabaseIdentificacaoContatoGateway(supabaseAdmin),
    makeEnvioMensagem(),
    new SupabaseDocumentosContratuaisGateway(supabaseAdmin),
    new SupabaseSessaoAtendimentoGateway(supabaseAdmin, MENSAGERIA_SEGREDO_SESSAO),
    new AbrirAtendimento(atendimentos),
    new AnexarMensagemAtendimento(atendimentos),
  );
}

export function makeAutenticacaoWebhook(): AutenticacaoWebhookPort {
  exigirSegredosDeProducao();
  return new HmacAutenticacaoWebhookGateway(
    MENSAGERIA_SEGREDO_ASSINATURA,
    MENSAGERIA_TOKEN_VERIFICACAO,
  );
}

// Adapta a sessão do módulo usuarios à porta própria de atendimento (arquitetura.md, seção 3.11);
// monta o ObterSessao direto, sem chamar usuarios.factory, pra não criar import circular. O adapter
// fica no `main` (não em infra) pelo mesmo motivo e padrão do clientes.factory.
function sessaoViaUsuarios(supabase: SupabaseClient): SessaoPort {
  const obterSessao = new ObterSessao(
    new SupabaseSessaoGateway(supabase),
    new SupabaseUsuarioRepository(supabase),
  );
  return {
    usuarioAtual: async (): Promise<AtorSessaoDto | null> => {
      const usuario = await obterSessao.execute();
      // O módulo usuarios só devolve Papel e Setor já validados (builder); o cast é a única fronteira.
      return usuario
        ? {
            id: usuario.id,
            papel: usuario.papel as Papel,
            setor: usuario.setor as SetorSlug,
          }
        : null;
    },
  };
}

// Best-effort: falha ao auditar não derruba a Transferência.
function auditoriaViaModuloAuditoria(): AuditoriaPort {
  return {
    registrar: async (input) => {
      const registrarAcao = await makeRegistrarAcao();
      const resultado = await registrarAcao.execute(input);
      if (!resultado.ok) console.error("Falha ao registrar auditoria:", resultado.error.message);
    },
  };
}

export async function makeTransferirAtendimento(): Promise<TransferirAtendimentoPort> {
  return new TransferirAtendimento(
    sessaoViaUsuarios(await createSupabaseServer()),
    new SupabaseAtendimentoRepository(createSupabaseAdmin()),
    makeEnvioMensagem(),
    auditoriaViaModuloAuditoria(),
  );
}
