import "server-only";

import { tmpdir } from "node:os";
import { join } from "node:path";

import { headers } from "next/headers";
import {
  CRON_SECRET,
  E2E_ADAPTER_SECRET,
  EMAIL_MODO,
  EMAIL_REMETENTE,
  EMAIL_SMTP_SENHA,
  EMAIL_SMTP_USUARIO,
  FFMPEG_PATH,
  FINANCEIRO_TELEFONE,
  INATIVIDADE_AUTOMATICA,
  LEMBRETES_AUTOMATICOS,
  MENSAGERIA_MODO,
  MENSAGERIA_SEGREDO_ASSINATURA,
  MENSAGERIA_SEGREDO_SESSAO,
  MENSAGERIA_TOKEN_VERIFICACAO,
  NODE_ENV,
  WHATSAPP_PHONE_NUMBER_ID,
  WHATSAPP_TOKEN,
} from "@/env";
import type { SupabaseClient } from "@supabase/supabase-js";

import { makeRegistrarAcao } from "@/main/auditoria.factory";
import { makeCertidaoCnd, makeObrigacoesFiscais } from "@/main/obrigacoes-fiscais.factory";
import {
  CABECALHO_ADAPTER_FALSO_E2E,
  exigirSegredosReais,
  pedeAdapterFalsoDoE2E,
} from "@/main/segredos-mensageria.factory";
import { createSupabaseAdmin } from "@/main/supabase-admin.factory";
import { createSupabaseServer } from "@/main/supabase-server.factory";
import type { AutenticarWebhookPort } from "@/modules/atendimento/application/ports/in/autenticar-webhook.provider";
import type { AvisarClientePort } from "@/modules/atendimento/application/ports/in/avisar-cliente.provider";
import type { EncerrarAtendimentoPort } from "@/modules/atendimento/application/ports/in/encerrar-atendimento.provider";
import type { EnviarAnexoAoClientePort } from "@/modules/atendimento/application/ports/in/enviar-anexo-ao-cliente.provider";
import type { EnviarDocumentoAoClientePort } from "@/modules/atendimento/application/ports/in/enviar-documento-ao-cliente.provider";
import type { EnviarMensagemAoClientePort } from "@/modules/atendimento/application/ports/in/enviar-mensagem-ao-cliente.provider";
import type { ExecutarEnvioGuiaParcelamentoPort } from "@/modules/atendimento/application/ports/in/executar-envio-guia-parcelamento.provider";
import type { ExecutarLembretesDocumentoEDasPort } from "@/modules/atendimento/application/ports/in/executar-lembretes-documento-e-das.provider";
import type {
  CadastrarFeriadoPort,
  ListarFeriadosPort,
  RemoverFeriadoPort,
} from "@/modules/atendimento/application/ports/in/gerenciar-feriados.provider";
import type { ListarFilaPort } from "@/modules/atendimento/application/ports/in/listar-fila.provider";
import type { ListarMeusAtendimentosPort } from "@/modules/atendimento/application/ports/in/listar-meus-atendimentos.provider";
import type { ObterConversaPort } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";
import type { ReagirAMensagemPort } from "@/modules/atendimento/application/ports/in/reagir-a-mensagem.provider";
import type { ReceberMensagemPort } from "@/modules/atendimento/application/ports/in/receber-mensagem.provider";
import type { ReceberMidiaPort } from "@/modules/atendimento/application/ports/in/receber-midia.provider";
import type { TransferirAtendimentoPort } from "@/modules/atendimento/application/ports/in/transferir-atendimento.provider";
import type { VerificarInatividadePort } from "@/modules/atendimento/application/ports/in/verificar-inatividade.provider";
import type { AuditoriaPort } from "@/modules/atendimento/application/ports/out/auditoria.provider";
import type { AutenticacaoJobPort } from "@/modules/atendimento/application/ports/out/autenticacao-job.provider";
import type { EnvioEmailPort } from "@/modules/atendimento/application/ports/out/envio-email.provider";
import type { EnvioMensagemPort } from "@/modules/atendimento/application/ports/out/envio-mensagem.provider";
import type {
  AtorSessaoDto,
  SessaoPort,
} from "@/modules/atendimento/application/ports/out/sessao.provider";
import { AbrirAtendimento } from "@/modules/atendimento/application/use-cases/abrir-atendimento.use-case";
import { AnexarMensagemAtendimento } from "@/modules/atendimento/application/use-cases/anexar-mensagem-atendimento.use-case";
import { AutenticarWebhook } from "@/modules/atendimento/application/use-cases/autenticar-webhook.use-case";
import { AvisarCliente } from "@/modules/atendimento/application/use-cases/avisar-cliente.use-case";
import { CadastrarFeriado } from "@/modules/atendimento/application/use-cases/cadastrar-feriado.use-case";
import { EncerrarAtendimento } from "@/modules/atendimento/application/use-cases/encerrar-atendimento.use-case";
import { EntregarComunicacaoPorCanais } from "@/modules/atendimento/application/use-cases/entregar-comunicacao-por-canais.use-case";
import { EntregarDasNaUra } from "@/modules/atendimento/application/use-cases/entregar-das-na-ura.use-case";
import { EnviarAnexoAoCliente } from "@/modules/atendimento/application/use-cases/enviar-anexo-ao-cliente.use-case";
import { EnviarComunicacaoProativa } from "@/modules/atendimento/application/use-cases/enviar-comunicacao-proativa.use-case";
import { EnviarDocumentoAoCliente } from "@/modules/atendimento/application/use-cases/enviar-documento-ao-cliente.use-case";
import { EnviarGuiasParcelamento } from "@/modules/atendimento/application/use-cases/enviar-guias-parcelamento.use-case";
import { EnviarMensagemAoCliente } from "@/modules/atendimento/application/use-cases/enviar-mensagem-ao-cliente.use-case";
import { ExecutarEnvioGuiaParcelamento } from "@/modules/atendimento/application/use-cases/executar-envio-guia-parcelamento.use-case";
import { ExecutarLembretesDocumentoEDas } from "@/modules/atendimento/application/use-cases/executar-lembretes-documento-e-das.use-case";
import { ListarFeriados } from "@/modules/atendimento/application/use-cases/listar-feriados.use-case";
import { ListarFila } from "@/modules/atendimento/application/use-cases/listar-fila.use-case";
import { ListarMeusAtendimentos } from "@/modules/atendimento/application/use-cases/listar-meus-atendimentos.use-case";
import { ObterConversa } from "@/modules/atendimento/application/use-cases/obter-conversa.use-case";
import { ObterGuiaDasParaEnvio } from "@/modules/atendimento/application/use-cases/obter-guia-das-para-envio.use-case";
import { PrepararAnexoParaEnvio } from "@/modules/atendimento/application/use-cases/preparar-anexo-para-envio.use-case";
import { ReagirAMensagem } from "@/modules/atendimento/application/use-cases/reagir-a-mensagem.use-case";
import { ReceberMensagem } from "@/modules/atendimento/application/use-cases/receber-mensagem.use-case";
import { ReceberMidia } from "@/modules/atendimento/application/use-cases/receber-midia.use-case";
import { RemoverFeriado } from "@/modules/atendimento/application/use-cases/remover-feriado.use-case";
import { TransferirAtendimento } from "@/modules/atendimento/application/use-cases/transferir-atendimento.use-case";
import { VerificarInatividade } from "@/modules/atendimento/application/use-cases/verificar-inatividade.use-case";
import { BearerAutenticacaoJobGateway } from "@/modules/atendimento/infra/gateways/bearer-autenticacao-job.gateway";
import { DownloadMidiaFalsoGateway } from "@/modules/atendimento/infra/gateways/download-midia-falso.gateway";
import { DownloadMidiaWhatsappGateway } from "@/modules/atendimento/infra/gateways/download-midia-whatsapp.gateway";
import { EnvioEmailFalsoGateway } from "@/modules/atendimento/infra/gateways/envio-email-falso.gateway";
import { EnvioEmailIndisponivelGateway } from "@/modules/atendimento/infra/gateways/envio-email-indisponivel.gateway";
import { EnvioEmailSmtpGateway } from "@/modules/atendimento/infra/gateways/envio-email-smtp.gateway";
import { EnvioMensagemFalsoGateway } from "@/modules/atendimento/infra/gateways/envio-mensagem-falso.gateway";
import { EnvioMensagemWhatsappGateway } from "@/modules/atendimento/infra/gateways/envio-mensagem-whatsapp.gateway";
import { FfmpegConversorDeAudioGateway } from "@/modules/atendimento/infra/gateways/ffmpeg-conversor-de-audio.gateway";
import { GuiasFiscaisGateway } from "@/modules/atendimento/infra/gateways/guias-fiscais.gateway";
import { HmacAutenticacaoWebhookGateway } from "@/modules/atendimento/infra/gateways/hmac-autenticacao-webhook.gateway";
import { RelogioSistemaGateway } from "@/modules/atendimento/infra/gateways/relogio-sistema.gateway";
import { resolverFfmpeg } from "@/modules/atendimento/infra/gateways/resolver-ffmpeg.gateway";
import { SupabaseAlertaSetorGateway } from "@/modules/atendimento/infra/gateways/supabase-alerta-setor.gateway";
import { SupabaseAnexosAtendimentoGateway } from "@/modules/atendimento/infra/gateways/supabase-anexos-atendimento.gateway";
import { SupabaseClienteCnpjGateway } from "@/modules/atendimento/infra/gateways/supabase-cliente-cnpj.gateway";
import { SupabaseClientesParaLembreteGateway } from "@/modules/atendimento/infra/gateways/supabase-clientes-para-lembrete.gateway";
import { SupabaseClientesParaParcelamentoGateway } from "@/modules/atendimento/infra/gateways/supabase-clientes-para-parcelamento.gateway";
import { SupabaseDocumentosContratuaisGateway } from "@/modules/atendimento/infra/gateways/supabase-documentos-contratuais.gateway";
import { SupabaseGuiaPublicadaGateway } from "@/modules/atendimento/infra/gateways/supabase-guia-publicada.gateway";
import { SupabaseIdentificacaoContatoGateway } from "@/modules/atendimento/infra/gateways/supabase-identificacao-contato.gateway";
import { SupabaseParcelamentosDoClienteGateway } from "@/modules/atendimento/infra/gateways/supabase-parcelamentos-do-cliente.gateway";
import { SupabaseSessaoAtendimentoGateway } from "@/modules/atendimento/infra/gateways/supabase-sessao-atendimento.gateway";
import { SupabaseAtendimentoRepository } from "@/modules/atendimento/infra/repositories/atendimento.repository";
import { SupabaseFeriadoRepository } from "@/modules/atendimento/infra/repositories/feriado.repository";
import { ObterSessao } from "@/modules/usuarios/application/use-cases/obter-sessao.use-case";
import { SupabaseSessaoGateway } from "@/modules/usuarios/infra/gateways/supabase-sessao.gateway";
import { SupabaseUsuarioRepository } from "@/modules/usuarios/infra/repositories/usuario.repository";
import { ESPERA_MS, TENTATIVAS } from "@/shared/kernel/com-tentativas";
import type { Papel } from "@/shared/kernel/papeis";
import type { SetorSlug } from "@/shared/kernel/setores";

// Instância única: o falso guarda em memória o que "enviou".
const envioFalso = new EnvioMensagemFalsoGateway();

// Modo do ambiente; vale onde não há requisição de usuário (jobs).
function makeEnvioMensagem(): EnvioMensagemPort {
  if (MENSAGERIA_MODO !== "real") return envioFalso;
  // env.ts garante as duas credenciais com o modo real.
  return new EnvioMensagemWhatsappGateway(WHATSAPP_TOKEN!, WHATSAPP_PHONE_NUMBER_ID!);
}

// Uma requisição dos e2e pode pedir o adapter falso (cabeçalho secreto) mesmo com o deploy em modo real.
async function requisicaoPedeAdapterFalso(): Promise<boolean> {
  if (!E2E_ADAPTER_SECRET) return false;
  return pedeAdapterFalsoDoE2E(
    E2E_ADAPTER_SECRET,
    (await headers()).get(CABECALHO_ADAPTER_FALSO_E2E),
  );
}

async function makeEnvioMensagemDaRequisicao(): Promise<EnvioMensagemPort> {
  return (await requisicaoPedeAdapterFalso()) ? envioFalso : makeEnvioMensagem();
}

// Chamada por makeAutenticarWebhook e makeReceberMensagem: nenhum caminho da rota pública
// (GET/POST) chega ao client privilegiado nem valida HMAC com segredo de desenvolvimento.
function exigirSegredosDeProducao(): void {
  exigirSegredosReais(
    {
      assinatura: MENSAGERIA_SEGREDO_ASSINATURA,
      tokenVerificacao: MENSAGERIA_TOKEN_VERIFICACAO,
      sessao: MENSAGERIA_SEGREDO_SESSAO,
    },
    NODE_ENV === "production",
  );
}

function guiasFiscais(supabaseAdmin: SupabaseClient): GuiasFiscaisGateway {
  return new GuiasFiscaisGateway(
    new SupabaseClienteCnpjGateway(supabaseAdmin),
    makeObrigacoesFiscais(),
    makeCertidaoCnd(),
  );
}

function entregarDasNaUra(
  supabaseAdmin: SupabaseClient,
  envio: EnvioMensagemPort,
): EntregarDasNaUra {
  const publicadas = new SupabaseGuiaPublicadaGateway(supabaseAdmin);
  return new EntregarDasNaUra(
    new SupabaseClientesParaLembreteGateway(supabaseAdmin),
    new ObterGuiaDasParaEnvio(guiasFiscais(supabaseAdmin), publicadas),
    publicadas,
    envio,
    new RelogioSistemaGateway(),
  );
}

export async function makeReceberMensagem(): Promise<ReceberMensagemPort> {
  exigirSegredosDeProducao();
  const supabaseAdmin = createSupabaseAdmin();
  const envio = await makeEnvioMensagemDaRequisicao();
  const atendimentos = new SupabaseAtendimentoRepository(supabaseAdmin);
  return new ReceberMensagem(
    new SupabaseIdentificacaoContatoGateway(supabaseAdmin),
    envio,
    new SupabaseDocumentosContratuaisGateway(supabaseAdmin),
    new SupabaseSessaoAtendimentoGateway(supabaseAdmin, MENSAGERIA_SEGREDO_SESSAO),
    new AbrirAtendimento(atendimentos, new AvisarCliente(envio, atendimentos)),
    new AnexarMensagemAtendimento(atendimentos),
    new RelogioSistemaGateway(),
    new SupabaseFeriadoRepository(supabaseAdmin),
    guiasFiscais(supabaseAdmin),
    entregarDasNaUra(supabaseAdmin, envio),
  );
}

export async function makeReceberMidia(): Promise<ReceberMidiaPort> {
  exigirSegredosDeProducao();
  const supabaseAdmin = createSupabaseAdmin();
  const falso = await requisicaoPedeAdapterFalso();
  return new ReceberMidia(
    new SupabaseAtendimentoRepository(supabaseAdmin),
    MENSAGERIA_MODO === "real" && !falso
      ? new DownloadMidiaWhatsappGateway(WHATSAPP_TOKEN!)
      : new DownloadMidiaFalsoGateway(),
    new SupabaseAnexosAtendimentoGateway(supabaseAdmin),
    falso ? envioFalso : makeEnvioMensagem(),
  );
}

export function makeAutenticacaoJob(): AutenticacaoJobPort {
  return new BearerAutenticacaoJobGateway(CRON_SECRET);
}

export function makeAutenticarWebhook(): AutenticarWebhookPort {
  exigirSegredosDeProducao();
  return new AutenticarWebhook(
    new HmacAutenticacaoWebhookGateway(MENSAGERIA_SEGREDO_ASSINATURA, MENSAGERIA_TOKEN_VERIFICACAO),
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

function makeAvisarCliente(
  repositorio: SupabaseAtendimentoRepository,
  envio: EnvioMensagemPort = makeEnvioMensagem(),
): AvisarClientePort {
  return new AvisarCliente(envio, repositorio);
}

export async function makeTransferirAtendimento(): Promise<TransferirAtendimentoPort> {
  const repositorio = new SupabaseAtendimentoRepository(createSupabaseAdmin());
  return new TransferirAtendimento(
    sessaoViaUsuarios(await createSupabaseServer()),
    repositorio,
    auditoriaViaModuloAuditoria(),
    makeAvisarCliente(repositorio, await makeEnvioMensagemDaRequisicao()),
  );
}

export async function makeEncerrarAtendimento(): Promise<EncerrarAtendimentoPort> {
  const repositorio = new SupabaseAtendimentoRepository(createSupabaseAdmin());
  return new EncerrarAtendimento(
    sessaoViaUsuarios(await createSupabaseServer()),
    repositorio,
    makeAvisarCliente(repositorio, await makeEnvioMensagemDaRequisicao()),
  );
}

// O job só age com a flag ligada, e em produção só com mensageria real: o adapter falso "envia"
// sem avisar ninguém (encerraria Atendimento ou marcaria DAS como enviado sem o cliente saber).
// Autenticar o job (CRON_SECRET) não autoriza executá-lo.
function jobAutomaticoAtivo(flag: string): boolean {
  return flag === "ligada" && !(NODE_ENV === "production" && MENSAGERIA_MODO === "falso");
}

export function inatividadeAutomaticaAtiva(): boolean {
  return jobAutomaticoAtivo(INATIVIDADE_AUTOMATICA);
}

export function lembretesAutomaticosAtivos(): boolean {
  return jobAutomaticoAtivo(LEMBRETES_AUTOMATICOS);
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

// Em produção o e-mail falso responderia ok sem enviar nada: sem EMAIL_MODO=real o canal falha de
// forma explícita.
function makeEnvioEmail(): EnvioEmailPort {
  if (EMAIL_MODO === "real") {
    // env.ts garante usuário, senha de app e remetente com o modo real.
    return new EnvioEmailSmtpGateway({
      usuario: EMAIL_SMTP_USUARIO!,
      senha: EMAIL_SMTP_SENHA!,
      remetente: EMAIL_REMETENTE!,
    });
  }
  return NODE_ENV === "production"
    ? new EnvioEmailIndisponivelGateway()
    : new EnvioEmailFalsoGateway();
}

// Job (service_role, sem sessão de usuário): lembrete de documento e envio de DAS.
export function makeExecutarLembretesDocumentoEDas(): ExecutarLembretesDocumentoEDasPort {
  const supabaseAdmin = createSupabaseAdmin();
  return new ExecutarLembretesDocumentoEDas(
    new SupabaseClientesParaLembreteGateway(supabaseAdmin),
    new ObterGuiaDasParaEnvio(
      guiasFiscais(supabaseAdmin),
      new SupabaseGuiaPublicadaGateway(supabaseAdmin),
    ),
    new EntregarComunicacaoPorCanais(
      new EnviarComunicacaoProativa(makeEnvioMensagem(), TENTATIVAS, ESPERA_MS),
      makeEnvioEmail(),
    ),
    new SupabaseAlertaSetorGateway(supabaseAdmin, "lembretes"),
    new RelogioSistemaGateway(),
  );
}

// Job (service_role, sem sessão de usuário): envio da guia de parcelamento. Mesma flag do job de
// lembrete: os dois são comunicação automática ao Cliente.
export function makeExecutarEnvioGuiaParcelamento(): ExecutarEnvioGuiaParcelamentoPort {
  const supabaseAdmin = createSupabaseAdmin();
  const envio = makeEnvioMensagem();
  return new ExecutarEnvioGuiaParcelamento(
    new SupabaseClientesParaParcelamentoGateway(supabaseAdmin),
    new EnviarGuiasParcelamento(
      new SupabaseParcelamentosDoClienteGateway(supabaseAdmin),
      guiasFiscais(supabaseAdmin),
      new SupabaseGuiaPublicadaGateway(supabaseAdmin),
      new EntregarComunicacaoPorCanais(
        new EnviarComunicacaoProativa(envio, TENTATIVAS, ESPERA_MS),
        makeEnvioEmail(),
      ),
      {
        envio,
        cnpjs: new SupabaseClienteCnpjGateway(supabaseAdmin),
        telefone: FINANCEIRO_TELEFONE ?? null,
      },
    ),
    new SupabaseAlertaSetorGateway(supabaseAdmin, "parcelamento"),
    new RelogioSistemaGateway(),
  );
}

export async function makeListarFila(): Promise<ListarFilaPort> {
  return new ListarFila(
    sessaoViaUsuarios(await createSupabaseServer()),
    new SupabaseAtendimentoRepository(createSupabaseAdmin()),
    new RelogioSistemaGateway(),
  );
}

export async function makeListarMeusAtendimentos(): Promise<ListarMeusAtendimentosPort> {
  return new ListarMeusAtendimentos(
    sessaoViaUsuarios(await createSupabaseServer()),
    new SupabaseAtendimentoRepository(createSupabaseAdmin()),
  );
}

export async function makeObterConversa(): Promise<ObterConversaPort> {
  const supabaseAdmin = createSupabaseAdmin();
  return new ObterConversa(
    sessaoViaUsuarios(await createSupabaseServer()),
    new SupabaseAtendimentoRepository(supabaseAdmin),
    new SupabaseDocumentosContratuaisGateway(supabaseAdmin),
    new SupabaseAnexosAtendimentoGateway(supabaseAdmin),
  );
}

// `FFMPEG_PATH` manda; senão o binário comprimido do build (menor na função); senão o do pacote
// ffmpeg-static (desenvolvimento) ou o do PATH. Só é chamada quando há áudio webm a converter.
function caminhoDoFfmpeg(): Promise<string> {
  if (FFMPEG_PATH) return Promise.resolve(FFMPEG_PATH);
  return resolverFfmpeg({
    comprimido: join(process.cwd(), ".ffmpeg", "ffmpeg.br"),
    destino: join(tmpdir(), "rigoni-ffmpeg", "ffmpeg"),
    alternativo: async () => {
      // Import dinâmico: no deploy o pacote é excluído do trace (só o comprimido segue).
      const pacote = await import("ffmpeg-static").catch(() => null);
      return pacote?.default ?? "ffmpeg";
    },
  });
}

export async function makeEnviarAnexoAoCliente(): Promise<EnviarAnexoAoClientePort> {
  const supabaseAdmin = createSupabaseAdmin();
  const anexos = new SupabaseAnexosAtendimentoGateway(supabaseAdmin);
  return new EnviarAnexoAoCliente(
    sessaoViaUsuarios(await createSupabaseServer()),
    new SupabaseAtendimentoRepository(supabaseAdmin),
    anexos,
    await makeEnvioMensagemDaRequisicao(),
    auditoriaViaModuloAuditoria(),
    new PrepararAnexoParaEnvio(anexos, new FfmpegConversorDeAudioGateway(caminhoDoFfmpeg)),
  );
}

export async function makeEnviarDocumentoAoCliente(): Promise<EnviarDocumentoAoClientePort> {
  const supabaseAdmin = createSupabaseAdmin();
  return new EnviarDocumentoAoCliente(
    sessaoViaUsuarios(await createSupabaseServer()),
    new SupabaseAtendimentoRepository(supabaseAdmin),
    new SupabaseDocumentosContratuaisGateway(supabaseAdmin),
    guiasFiscais(supabaseAdmin),
    await makeEnvioMensagemDaRequisicao(),
    auditoriaViaModuloAuditoria(),
  );
}

export async function makeEnviarMensagemAoCliente(): Promise<EnviarMensagemAoClientePort> {
  return new EnviarMensagemAoCliente(
    sessaoViaUsuarios(await createSupabaseServer()),
    new SupabaseAtendimentoRepository(createSupabaseAdmin()),
    await makeEnvioMensagemDaRequisicao(),
    auditoriaViaModuloAuditoria(),
  );
}

export async function makeReagirAMensagem(): Promise<ReagirAMensagemPort> {
  return new ReagirAMensagem(
    sessaoViaUsuarios(await createSupabaseServer()),
    new SupabaseAtendimentoRepository(createSupabaseAdmin()),
    await makeEnvioMensagemDaRequisicao(),
    auditoriaViaModuloAuditoria(),
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
