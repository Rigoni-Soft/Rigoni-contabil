import "server-only";

import { LEITURA_PDF_MODO } from "@/env";
import type { SupabaseClient } from "@supabase/supabase-js";

import { makeRegistrarAcao } from "@/main/auditoria.factory";
import { createSupabaseAdmin } from "@/main/supabase-admin.factory";
import { createSupabaseServer } from "@/main/supabase-server.factory";
import type { AnexarAlteracaoContratualPort } from "@/modules/clientes/application/ports/in/anexar-alteracao-contratual.provider";
import type { AnexarGuiaParcelaPgfnPort } from "@/modules/clientes/application/ports/in/anexar-guia-parcela-pgfn.provider";
import type { AtribuirResponsavelClientePort } from "@/modules/clientes/application/ports/in/atribuir-responsavel-cliente.provider";
import type { ConfirmarGuiaParcelaPgfnPort } from "@/modules/clientes/application/ports/in/confirmar-guia-parcela-pgfn.provider";
import type { ContarAvisosNaoVistosPort } from "@/modules/clientes/application/ports/in/contar-avisos-nao-vistos.provider";
import type { CriarClientePort } from "@/modules/clientes/application/ports/in/criar-cliente.provider";
import type {
  ListarDocumentosContratuaisClientePort,
  ObterLinkDocumentoContratualPort,
} from "@/modules/clientes/application/ports/in/documentos-contratuais-cliente.provider";
import type { EditarCadastroOperacionalClientePort } from "@/modules/clientes/application/ports/in/editar-cadastro-operacional-cliente.provider";
import type { LerPdfDeParcelamentoPort } from "@/modules/clientes/application/ports/in/ler-pdf-de-parcelamento.provider";
import type { ListarAvisosCadastroPort } from "@/modules/clientes/application/ports/in/listar-avisos-cadastro.provider";
import type { ListarGuiasParcelaPgfnPort } from "@/modules/clientes/application/ports/in/listar-guias-parcela-pgfn.provider";
import type { MarcarAvisoVistoPort } from "@/modules/clientes/application/ports/in/marcar-aviso-visto.provider";
import type { ObterLinkGuiaParcelaPgfnPort } from "@/modules/clientes/application/ports/in/obter-link-guia-parcela-pgfn.provider";
import type { RemoverGuiaParcelaPgfnPort } from "@/modules/clientes/application/ports/in/remover-guia-parcela-pgfn.provider";
import type { SalvarParcelamentosClientePort } from "@/modules/clientes/application/ports/in/salvar-parcelamentos-cliente.provider";
import type { TrocarGuiaParcelaPgfnPort } from "@/modules/clientes/application/ports/in/trocar-guia-parcela-pgfn.provider";
import type { AuditoriaPort } from "@/modules/clientes/application/ports/out/auditoria.provider";
import type { LeitorDeGuiaDeParcelaPort } from "@/modules/clientes/application/ports/out/leitor-de-guia-de-parcela.provider";
import type { LeitorDeParcelamentoPort } from "@/modules/clientes/application/ports/out/leitor-de-parcelamento.provider";
import type {
  AtorSessaoDto,
  SessaoPort,
} from "@/modules/clientes/application/ports/out/sessao.provider";
import { AnexarAlteracaoContratual } from "@/modules/clientes/application/use-cases/anexar-alteracao-contratual.use-case";
import { AnexarGuiaParcelaPgfn } from "@/modules/clientes/application/use-cases/anexar-guia-parcela-pgfn.use-case";
import { AtribuirResponsavelCliente } from "@/modules/clientes/application/use-cases/atribuir-responsavel-cliente.use-case";
import { BuscarClientes } from "@/modules/clientes/application/use-cases/buscar-clientes.use-case";
import { ConfirmarGuiaParcelaPgfn } from "@/modules/clientes/application/use-cases/confirmar-guia-parcela-pgfn.use-case";
import { ConsultarCadastroOperacionalCliente } from "@/modules/clientes/application/use-cases/consultar-cadastro-operacional-cliente.use-case";
import { ContarAvisosNaoVistos } from "@/modules/clientes/application/use-cases/contar-avisos-nao-vistos.use-case";
import { CriarCliente } from "@/modules/clientes/application/use-cases/criar-cliente.use-case";
import { EditarCadastroOperacionalCliente } from "@/modules/clientes/application/use-cases/editar-cadastro-operacional-cliente.use-case";
import { LerPdfDeParcelamento } from "@/modules/clientes/application/use-cases/ler-pdf-de-parcelamento.use-case";
import { ListarAvisosCadastro } from "@/modules/clientes/application/use-cases/listar-avisos-cadastro.use-case";
import { ListarDocumentosContratuaisCliente } from "@/modules/clientes/application/use-cases/listar-documentos-contratuais-cliente.use-case";
import { ListarGuiasParcelaPgfn } from "@/modules/clientes/application/use-cases/listar-guias-parcela-pgfn.use-case";
import { ListarResponsaveisElegiveis } from "@/modules/clientes/application/use-cases/listar-responsaveis-elegiveis.use-case";
import { MarcarAvisoVisto } from "@/modules/clientes/application/use-cases/marcar-aviso-visto.use-case";
import { ObterLinkDocumentoContratual } from "@/modules/clientes/application/use-cases/obter-link-documento-contratual.use-case";
import { ObterLinkGuiaParcelaPgfn } from "@/modules/clientes/application/use-cases/obter-link-guia-parcela-pgfn.use-case";
import { ObterResumoSetorSn } from "@/modules/clientes/application/use-cases/obter-resumo-setor-sn.use-case";
import { RemoverGuiaParcelaPgfn } from "@/modules/clientes/application/use-cases/remover-guia-parcela-pgfn.use-case";
import { SalvarParcelamentosCliente } from "@/modules/clientes/application/use-cases/salvar-parcelamentos-cliente.use-case";
import { TrocarGuiaParcelaPgfn } from "@/modules/clientes/application/use-cases/trocar-guia-parcela-pgfn.use-case";
import { SupabaseAvisosCadastroGateway } from "@/modules/clientes/infra/gateways/avisos-cadastro.gateway";
import { SupabaseClienteQueryGateway } from "@/modules/clientes/infra/gateways/cliente-query.gateway";
import { SupabaseDocumentosContratuaisClienteGateway } from "@/modules/clientes/infra/gateways/documentos-contratuais-cliente.gateway";
import { LeitorDeGuiaDeParcelaFalsoGateway } from "@/modules/clientes/infra/gateways/leitor-de-guia-de-parcela-falso.gateway";
import { LeitorDeGuiaDeParcelaTextoGateway } from "@/modules/clientes/infra/gateways/leitor-de-guia-de-parcela-texto.gateway";
import { LeitorDeParcelamentoFalsoGateway } from "@/modules/clientes/infra/gateways/leitor-de-parcelamento-falso.gateway";
import { LeitorDeParcelamentoTextoGateway } from "@/modules/clientes/infra/gateways/leitor-de-parcelamento-texto.gateway";
import { RelogioSistemaGateway } from "@/modules/clientes/infra/gateways/relogio-sistema.gateway";
import { SupabaseArquivoStorageGateway } from "@/modules/clientes/infra/gateways/supabase-arquivo-storage.gateway";
import { SupabaseClienteParcelamentoRepository } from "@/modules/clientes/infra/repositories/cliente-parcelamento.repository";
import { SupabaseClienteRepository } from "@/modules/clientes/infra/repositories/cliente.repository";
import { SupabaseGuiaParcelaPgfnRepository } from "@/modules/clientes/infra/repositories/guia-parcela-pgfn.repository";
import { SupabaseResponsavelClienteRepository } from "@/modules/clientes/infra/repositories/responsavel-cliente.repository";
import { ObterSessao } from "@/modules/usuarios/application/use-cases/obter-sessao.use-case";
import { SupabaseSessaoGateway } from "@/modules/usuarios/infra/gateways/supabase-sessao.gateway";
import { SupabaseUsuarioRepository } from "@/modules/usuarios/infra/repositories/usuario.repository";

// Adapta a sessão do módulo usuarios à porta própria de clientes (arquitetura.md,
// seção 3.11) — monta o ObterSessao direto (não chama usuarios.factory) pra não
// criar import circular entre as duas factories, mesmo motivo do auditoria.factory.
function sessaoViaUsuarios(supabase: SupabaseClient): SessaoPort {
  const obterSessao = new ObterSessao(
    new SupabaseSessaoGateway(supabase),
    new SupabaseUsuarioRepository(supabase),
  );
  return {
    usuarioAtual: async (): Promise<AtorSessaoDto | null> => {
      const usuario = await obterSessao.execute();
      return usuario ? { id: usuario.id, papel: usuario.papel, setor: usuario.setor } : null;
    },
  };
}

// Best-effort: falha ao auditar não derruba o cadastro (mesmo contrato do usuarios.factory).
function auditoriaViaModuloAuditoria(): AuditoriaPort {
  return {
    registrar: async (input) => {
      const registrarAcao = await makeRegistrarAcao();
      const resultado = await registrarAcao.execute(input);
      if (!resultado.ok) console.error("Falha ao registrar auditoria:", resultado.error.message);
    },
  };
}

export async function makeCriarCliente(): Promise<CriarClientePort> {
  const supabase = await createSupabaseServer();
  return new CriarCliente(
    sessaoViaUsuarios(supabase),
    new SupabaseClienteRepository(supabase),
    new SupabaseArquivoStorageGateway(supabase),
    auditoriaViaModuloAuditoria(),
  );
}

export async function makeAnexarAlteracaoContratual(): Promise<AnexarAlteracaoContratualPort> {
  const supabase = await createSupabaseServer();
  return new AnexarAlteracaoContratual(
    sessaoViaUsuarios(supabase),
    new SupabaseClienteRepository(supabase),
    new SupabaseArquivoStorageGateway(supabase),
  );
}

// Bucket privado sem política de usuário: o PDF sobe e some pelo service role, depois de o caso de
// uso checar o papel. As linhas do banco seguem pela sessão do usuário (RLS decide o Responsável).
export async function makeSalvarParcelamentosCliente(): Promise<SalvarParcelamentosClientePort> {
  const supabase = await createSupabaseServer();
  return new SalvarParcelamentosCliente(
    sessaoViaUsuarios(supabase),
    new SupabaseClienteRepository(supabase),
    new SupabaseClienteParcelamentoRepository(supabase),
    new SupabaseArquivoStorageGateway(createSupabaseAdmin(), "parcelamentos-clientes"),
  );
}

// Guia da parcela PGFN: mesmo bucket privado dos acordos, prefixo próprio por Parcelamento e
// competência. As linhas seguem pela sessão do usuário (RLS); o arquivo, pelo service role.
export async function makeAnexarGuiaParcelaPgfn(): Promise<AnexarGuiaParcelaPgfnPort> {
  const supabase = await createSupabaseServer();
  return new AnexarGuiaParcelaPgfn(
    sessaoViaUsuarios(supabase),
    new SupabaseGuiaParcelaPgfnRepository(supabase),
    guiasStorage(),
    leitorDeGuiaDeParcela(),
  );
}

export async function makeConfirmarGuiaParcelaPgfn(): Promise<ConfirmarGuiaParcelaPgfnPort> {
  const supabase = await createSupabaseServer();
  return new ConfirmarGuiaParcelaPgfn(
    sessaoViaUsuarios(supabase),
    new SupabaseGuiaParcelaPgfnRepository(supabase),
  );
}

export async function makeListarGuiasParcelaPgfn(): Promise<ListarGuiasParcelaPgfnPort> {
  const supabase = await createSupabaseServer();
  return new ListarGuiasParcelaPgfn(new SupabaseGuiaParcelaPgfnRepository(supabase));
}

const guiasStorage = () =>
  new SupabaseArquivoStorageGateway(createSupabaseAdmin(), "parcelamentos-clientes");

export async function makeTrocarGuiaParcelaPgfn(): Promise<TrocarGuiaParcelaPgfnPort> {
  const supabase = await createSupabaseServer();
  return new TrocarGuiaParcelaPgfn(
    sessaoViaUsuarios(supabase),
    new SupabaseGuiaParcelaPgfnRepository(supabase),
    guiasStorage(),
    leitorDeGuiaDeParcela(),
  );
}

export async function makeRemoverGuiaParcelaPgfn(): Promise<RemoverGuiaParcelaPgfnPort> {
  const supabase = await createSupabaseServer();
  return new RemoverGuiaParcelaPgfn(
    sessaoViaUsuarios(supabase),
    new SupabaseGuiaParcelaPgfnRepository(supabase),
    guiasStorage(),
  );
}

// O caminho vem da leitura pela sessão (RLS); o link é assinado pelo service role.
export async function makeObterLinkGuiaParcelaPgfn(): Promise<ObterLinkGuiaParcelaPgfnPort> {
  const supabase = await createSupabaseServer();
  return new ObterLinkGuiaParcelaPgfn(
    sessaoViaUsuarios(supabase),
    new SupabaseGuiaParcelaPgfnRepository(supabase),
    guiasStorage(),
  );
}

// Falso por padrão (dev, CI e Preview); "texto" lê a camada de texto do PDF no servidor.
function leitorDeGuiaDeParcela(): LeitorDeGuiaDeParcelaPort {
  return LEITURA_PDF_MODO === "texto"
    ? new LeitorDeGuiaDeParcelaTextoGateway()
    : new LeitorDeGuiaDeParcelaFalsoGateway();
}

function leitorDeParcelamento(): LeitorDeParcelamentoPort {
  return LEITURA_PDF_MODO === "texto"
    ? new LeitorDeParcelamentoTextoGateway()
    : new LeitorDeParcelamentoFalsoGateway();
}

export async function makeLerPdfDeParcelamento(): Promise<LerPdfDeParcelamentoPort> {
  const supabase = await createSupabaseServer();
  return new LerPdfDeParcelamento(
    sessaoViaUsuarios(supabase),
    new SupabaseClienteRepository(supabase),
    leitorDeParcelamento(),
  );
}

export async function makeEditarCadastroOperacionalCliente(): Promise<EditarCadastroOperacionalClientePort> {
  const supabase = await createSupabaseServer();
  return new EditarCadastroOperacionalCliente(
    sessaoViaUsuarios(supabase),
    new SupabaseClienteRepository(supabase),
    auditoriaViaModuloAuditoria(),
  );
}

export async function makeAtribuirResponsavelCliente(): Promise<AtribuirResponsavelClientePort> {
  const supabase = await createSupabaseServer();
  return new AtribuirResponsavelCliente(
    sessaoViaUsuarios(supabase),
    new SupabaseClienteQueryGateway(supabase),
    new SupabaseResponsavelClienteRepository(supabase),
    auditoriaViaModuloAuditoria(),
  );
}

export async function makeConsultarCadastroOperacionalCliente(): Promise<ConsultarCadastroOperacionalCliente> {
  const supabase = await createSupabaseServer();
  return new ConsultarCadastroOperacionalCliente(
    sessaoViaUsuarios(supabase),
    new SupabaseClienteQueryGateway(supabase),
  );
}

export async function makeBuscarClientes(): Promise<BuscarClientes> {
  const supabase = await createSupabaseServer();
  return new BuscarClientes(sessaoViaUsuarios(supabase), new SupabaseClienteQueryGateway(supabase));
}

export async function makeListarResponsaveisElegiveis(): Promise<ListarResponsaveisElegiveis> {
  const supabase = await createSupabaseServer();
  return new ListarResponsaveisElegiveis(
    sessaoViaUsuarios(supabase),
    new SupabaseClienteQueryGateway(supabase),
  );
}

export async function makeObterResumoSetorSn(): Promise<ObterResumoSetorSn> {
  const supabase = await createSupabaseServer();
  return new ObterResumoSetorSn(
    sessaoViaUsuarios(supabase),
    new SupabaseClienteQueryGateway(supabase),
    new RelogioSistemaGateway(),
  );
}

// Sessão do usuário (RLS), sem service_role e sem o gateway do Atendimento.
export async function makeListarDocumentosContratuaisCliente(): Promise<ListarDocumentosContratuaisClientePort> {
  const supabase = await createSupabaseServer();
  return new ListarDocumentosContratuaisCliente(
    sessaoViaUsuarios(supabase),
    new SupabaseDocumentosContratuaisClienteGateway(supabase),
  );
}

export async function makeObterLinkDocumentoContratual(): Promise<ObterLinkDocumentoContratualPort> {
  const supabase = await createSupabaseServer();
  return new ObterLinkDocumentoContratual(
    sessaoViaUsuarios(supabase),
    new SupabaseDocumentosContratuaisClienteGateway(supabase),
  );
}

// Sessão do usuário (RLS): cada um só enxerga e marca os próprios avisos.
export async function makeListarAvisosCadastro(): Promise<ListarAvisosCadastroPort> {
  const supabase = await createSupabaseServer();
  return new ListarAvisosCadastro(
    sessaoViaUsuarios(supabase),
    new SupabaseAvisosCadastroGateway(supabase),
  );
}

export async function makeContarAvisosNaoVistos(): Promise<ContarAvisosNaoVistosPort> {
  const supabase = await createSupabaseServer();
  return new ContarAvisosNaoVistos(
    sessaoViaUsuarios(supabase),
    new SupabaseAvisosCadastroGateway(supabase),
  );
}

export async function makeMarcarAvisoVisto(): Promise<MarcarAvisoVistoPort> {
  const supabase = await createSupabaseServer();
  return new MarcarAvisoVisto(
    sessaoViaUsuarios(supabase),
    new SupabaseAvisosCadastroGateway(supabase),
  );
}
