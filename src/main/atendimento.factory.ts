import "server-only";

import {
  JOBS_SEGREDO,
  MENSAGERIA_MODO,
  MENSAGERIA_SEGREDO_ASSINATURA,
  MENSAGERIA_SEGREDO_SESSAO,
  MENSAGERIA_TOKEN_VERIFICACAO,
  OBRIGACOES_FISCAIS_URL,
} from "@/env";
import type { SupabaseClient } from "@supabase/supabase-js";

import { makeRegistrarAcao } from "@/main/auditoria.factory";
import { exigirSegredosReais } from "@/main/segredos-mensageria.factory";
import { createSupabaseAdmin } from "@/main/supabase-admin.factory";
import { createSupabaseServer } from "@/main/supabase-server.factory";
import type { AvisarClientePort } from "@/modules/atendimento/application/ports/in/avisar-cliente.provider";
import type { EncerrarAtendimentoPort } from "@/modules/atendimento/application/ports/in/encerrar-atendimento.provider";
import type {
  CadastrarFeriadoPort,
  ListarFeriadosPort,
  RemoverFeriadoPort,
} from "@/modules/atendimento/application/ports/in/gerenciar-feriados.provider";
import type { ListarFilaPort } from "@/modules/atendimento/application/ports/in/listar-fila.provider";
import type { ReceberMensagemPort } from "@/modules/atendimento/application/ports/in/receber-mensagem.provider";
import type { TransferirAtendimentoPort } from "@/modules/atendimento/application/ports/in/transferir-atendimento.provider";
import type { VerificarInatividadePort } from "@/modules/atendimento/application/ports/in/verificar-inatividade.provider";
import type { AuditoriaPort } from "@/modules/atendimento/application/ports/out/auditoria.provider";
import type { AutenticacaoWebhookPort } from "@/modules/atendimento/application/ports/out/autenticacao-webhook.provider";
import type { EnvioMensagemPort } from "@/modules/atendimento/application/ports/out/envio-mensagem.provider";
import type {
  AtorSessaoDto,
  SessaoPort,
} from "@/modules/atendimento/application/ports/out/sessao.provider";
import { AbrirAtendimento } from "@/modules/atendimento/application/use-cases/abrir-atendimento.use-case";
import { AnexarMensagemAtendimento } from "@/modules/atendimento/application/use-cases/anexar-mensagem-atendimento.use-case";
import { AvisarCliente } from "@/modules/atendimento/application/use-cases/avisar-cliente.use-case";
import { CadastrarFeriado } from "@/modules/atendimento/application/use-cases/cadastrar-feriado.use-case";
import { EncerrarAtendimento } from "@/modules/atendimento/application/use-cases/encerrar-atendimento.use-case";
import { ListarFeriados } from "@/modules/atendimento/application/use-cases/listar-feriados.use-case";
import { ListarFila } from "@/modules/atendimento/application/use-cases/listar-fila.use-case";
import { ReceberMensagem } from "@/modules/atendimento/application/use-cases/receber-mensagem.use-case";
import { RemoverFeriado } from "@/modules/atendimento/application/use-cases/remover-feriado.use-case";
import { TransferirAtendimento } from "@/modules/atendimento/application/use-cases/transferir-atendimento.use-case";
import { VerificarInatividade } from "@/modules/atendimento/application/use-cases/verificar-inatividade.use-case";
import { EnvioMensagemFalsoGateway } from "@/modules/atendimento/infra/gateways/envio-mensagem-falso.gateway";
import { GuiasFiscaisGateway } from "@/modules/atendimento/infra/gateways/guias-fiscais.gateway";
import { HmacAutenticacaoWebhookGateway } from "@/modules/atendimento/infra/gateways/hmac-autenticacao-webhook.gateway";
import { RelogioSistemaGateway } from "@/modules/atendimento/infra/gateways/relogio-sistema.gateway";
import { SupabaseClienteCnpjGateway } from "@/modules/atendimento/infra/gateways/supabase-cliente-cnpj.gateway";
import { SupabaseDocumentosContratuaisGateway } from "@/modules/atendimento/infra/gateways/supabase-documentos-contratuais.gateway";
import { SupabaseIdentificacaoContatoGateway } from "@/modules/atendimento/infra/gateways/supabase-identificacao-contato.gateway";
import { SupabaseSessaoAtendimentoGateway } from "@/modules/atendimento/infra/gateways/supabase-sessao-atendimento.gateway";
import { SupabaseAtendimentoRepository } from "@/modules/atendimento/infra/repositories/atendimento.repository";
import { SupabaseFeriadoRepository } from "@/modules/atendimento/infra/repositories/feriado.repository";
import { ObrigacoesFiscaisHttpGateway } from "@/modules/clientes/infra/gateways/obrigacoes-fiscais-http.gateway";
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

function guiasFiscais(supabaseAdmin: SupabaseClient): GuiasFiscaisGateway {
  return new GuiasFiscaisGateway(
    new SupabaseClienteCnpjGateway(supabaseAdmin),
    new ObrigacoesFiscaisHttpGateway(OBRIGACOES_FISCAIS_URL),
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
    new AbrirAtendimento(atendimentos, new AvisarCliente(makeEnvioMensagem(), atendimentos)),
    new AnexarMensagemAtendimento(atendimentos),
    new RelogioSistemaGateway(),
    new SupabaseFeriadoRepository(supabaseAdmin),
    guiasFiscais(supabaseAdmin),
  );
}

// Quem chama o job precisa do segredo; sem ele configurado, ninguém chama.
export function jobAutorizado(authorization: string | null): boolean {
  return JOBS_SEGREDO !== undefined && authorization === `Bearer ${JOBS_SEGREDO}`;
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

function makeAvisarCliente(repositorio: SupabaseAtendimentoRepository): AvisarClientePort {
  return new AvisarCliente(makeEnvioMensagem(), repositorio);
}

export async function makeTransferirAtendimento(): Promise<TransferirAtendimentoPort> {
  const repositorio = new SupabaseAtendimentoRepository(createSupabaseAdmin());
  return new TransferirAtendimento(
    sessaoViaUsuarios(await createSupabaseServer()),
    repositorio,
    auditoriaViaModuloAuditoria(),
    makeAvisarCliente(repositorio),
  );
}

export async function makeEncerrarAtendimento(): Promise<EncerrarAtendimentoPort> {
  const repositorio = new SupabaseAtendimentoRepository(createSupabaseAdmin());
  return new EncerrarAtendimento(
    sessaoViaUsuarios(await createSupabaseServer()),
    repositorio,
    makeAvisarCliente(repositorio),
  );
}

// Job (service_role, sem sessão de usuário): a URA verifica a inatividade dos Atendimentos.
export function makeVerificarInatividade(): VerificarInatividadePort {
  const supabaseAdmin = createSupabaseAdmin();
  const repositorio = new SupabaseAtendimentoRepository(supabaseAdmin);
  return new VerificarInatividade(
    repositorio,
    makeAvisarCliente(repositorio),
    new RelogioSistemaGateway(),
    new SupabaseFeriadoRepository(supabaseAdmin),
  );
}

export async function makeListarFila(): Promise<ListarFilaPort> {
  return new ListarFila(
    sessaoViaUsuarios(await createSupabaseServer()),
    new SupabaseAtendimentoRepository(createSupabaseAdmin()),
    new RelogioSistemaGateway(),
  );
}

// Feriados do Admin: client da sessão dele, para a RLS e a auditoria do banco valerem.
async function makeFeriados() {
  const supabase = await createSupabaseServer();
  return {
    sessao: sessaoViaUsuarios(supabase),
    repositorio: new SupabaseFeriadoRepository(supabase),
  };
}

export async function makeListarFeriados(): Promise<ListarFeriadosPort> {
  const { sessao, repositorio } = await makeFeriados();
  return new ListarFeriados(sessao, repositorio);
}

export async function makeCadastrarFeriado(): Promise<CadastrarFeriadoPort> {
  const { sessao, repositorio } = await makeFeriados();
  return new CadastrarFeriado(sessao, repositorio);
}

export async function makeRemoverFeriado(): Promise<RemoverFeriadoPort> {
  const { sessao, repositorio } = await makeFeriados();
  return new RemoverFeriado(sessao, repositorio);
}
