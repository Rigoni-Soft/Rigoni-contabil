import { ConsoleRegistroDeErrosGateway as ConsoleUsuarios } from "@/modules/usuarios/infra/gateways/console-registro-de-erros.gateway";

import "server-only";

import { EXTRACAO_CONVENCAO_MODO } from "@/env";
import type { SupabaseClient } from "@supabase/supabase-js";

import { auditoriaBestEffort } from "@/main/auditoria.factory";
import { createSupabaseServer } from "@/main/supabase-server.factory";
import type {
  DefinirConvencaoDoEmpregadoPort,
  DefinirInterruptoresDoClientePort,
  EnviarConvencaoPort,
} from "@/modules/rh/application/ports/in/gerir-convencao.provider";
import type {
  CadastrarEmpregadoPort,
  CorrigirEmpregadoPort,
  DefinirEmpregadoAtivoPort,
  DefinirPadraoComissionadosPort,
  DefinirSemMovimentoPort,
} from "@/modules/rh/application/ports/in/gerir-quadro-de-funcionarios.provider";
import type {
  CriarServicoAcompanhamentoPort,
  DesativarServicoAcompanhamentoPort,
  RenomearServicoAcompanhamentoPort,
} from "@/modules/rh/application/ports/in/gerir-servico-acompanhamento.provider";
import type { IniciarCartaoDoPontoPort } from "@/modules/rh/application/ports/in/iniciar-cartao-do-ponto.provider";
import type {
  DefinirServicoAplicavelPort,
  MarcarServicoAcompanhamentoPort,
} from "@/modules/rh/application/ports/in/marcar-servico-acompanhamento.provider";
import type { ObterAcompanhamentoFuncionariosPort } from "@/modules/rh/application/ports/in/obter-acompanhamento-funcionarios.provider";
import type { ObterAcompanhamentoMensalPort } from "@/modules/rh/application/ports/in/obter-acompanhamento-mensal.provider";
import type { ObterConvencoesDoClientePort } from "@/modules/rh/application/ports/in/obter-convencoes-do-cliente.provider";
import type { ObterFolhaDePontoPort } from "@/modules/rh/application/ports/in/obter-folha-de-ponto.provider";
import type { SalvarDiaDoPontoPort } from "@/modules/rh/application/ports/in/salvar-dia-do-ponto.provider";
import type { AtorSessaoDto, SessaoPort } from "@/modules/rh/application/ports/out/sessao.provider";
import {
  DefinirConvencaoDoEmpregado,
  DefinirInterruptoresDoCliente,
} from "@/modules/rh/application/use-cases/definir-convencao-do-ponto.use-case";
import { EnviarConvencao } from "@/modules/rh/application/use-cases/enviar-convencao.use-case";
import {
  CadastrarEmpregado,
  CorrigirEmpregado,
  DefinirEmpregadoAtivo,
  DefinirPadraoComissionados,
  DefinirSemMovimento,
} from "@/modules/rh/application/use-cases/gerir-quadro-de-funcionarios.use-case";
import {
  CriarServicoAcompanhamento,
  DesativarServicoAcompanhamento,
  RenomearServicoAcompanhamento,
} from "@/modules/rh/application/use-cases/gerir-servico-acompanhamento.use-case";
import { IniciarCartaoDoPonto } from "@/modules/rh/application/use-cases/iniciar-cartao-do-ponto.use-case";
import {
  DefinirServicoAplicavel,
  MarcarServicoAcompanhamento,
} from "@/modules/rh/application/use-cases/marcar-servico-acompanhamento.use-case";
import { ObterAcompanhamentoFuncionarios } from "@/modules/rh/application/use-cases/obter-acompanhamento-funcionarios.use-case";
import { ObterAcompanhamentoMensal } from "@/modules/rh/application/use-cases/obter-acompanhamento-mensal.use-case";
import { ObterConvencoesDoCliente } from "@/modules/rh/application/use-cases/obter-convencoes-do-cliente.use-case";
import { ObterFolhaDePonto } from "@/modules/rh/application/use-cases/obter-folha-de-ponto.use-case";
import { SalvarDiaDoPonto } from "@/modules/rh/application/use-cases/salvar-dia-do-ponto.use-case";
import { ConsoleRegistroDeErrosGateway as ConsoleRh } from "@/modules/rh/infra/gateways/console-registro-de-erros.gateway";
import { ExtratorDeRegrasFalsoGateway } from "@/modules/rh/infra/gateways/extrator-de-regras-falso.gateway";
import { ExtratorDeRegrasIndisponivelGateway } from "@/modules/rh/infra/gateways/extrator-de-regras-indisponivel.gateway";
import { RelogioSistemaGateway } from "@/modules/rh/infra/gateways/relogio-sistema.gateway";
import { SupabaseArmazenamentoDeConvencaoGateway } from "@/modules/rh/infra/gateways/supabase-armazenamento-de-convencao.gateway";
import { SupabaseAcompanhamentoRepository } from "@/modules/rh/infra/repositories/acompanhamento.repository";
import { SupabaseConvencaoRepository } from "@/modules/rh/infra/repositories/convencao.repository";
import { SupabaseFolhaDePontoRepository } from "@/modules/rh/infra/repositories/folha-de-ponto.repository";
import { ObterSessao } from "@/modules/usuarios/application/use-cases/obter-sessao.use-case";
import { SupabaseSessaoGateway } from "@/modules/usuarios/infra/gateways/supabase-sessao.gateway";
import { SupabaseUsuarioRepository } from "@/modules/usuarios/infra/repositories/usuario.repository";

const errosRh = new ConsoleRh();
const errosUsuarios = new ConsoleUsuarios();

// Adapta a sessão do módulo usuarios à porta própria de rh (arquitetura.md, seção 3.11); monta o
// ObterSessao direto para não criar import circular entre as factories.
function sessaoViaUsuarios(supabase: SupabaseClient): SessaoPort {
  const obterSessao = new ObterSessao(
    new SupabaseSessaoGateway(supabase),
    new SupabaseUsuarioRepository(supabase),
    errosUsuarios,
  );
  return {
    usuarioAtual: async (): Promise<AtorSessaoDto | null> => {
      const usuario = await obterSessao.execute();
      return usuario ? { id: usuario.id, papel: usuario.papel, setor: usuario.setor } : null;
    },
  };
}

async function montar() {
  const supabase = await createSupabaseServer();
  return {
    sessao: sessaoViaUsuarios(supabase),
    repositorio: new SupabaseAcompanhamentoRepository(supabase, errosRh),
    auditoria: auditoriaBestEffort(errosRh),
  };
}

export async function makeObterAcompanhamentoMensal(): Promise<ObterAcompanhamentoMensalPort> {
  const { sessao, repositorio } = await montar();
  return new ObterAcompanhamentoMensal(sessao, repositorio, new RelogioSistemaGateway());
}

export async function makeObterAcompanhamentoFuncionarios(): Promise<ObterAcompanhamentoFuncionariosPort> {
  const { sessao, repositorio } = await montar();
  return new ObterAcompanhamentoFuncionarios(sessao, repositorio, new RelogioSistemaGateway());
}

export async function makeMarcarServicoAcompanhamento(): Promise<MarcarServicoAcompanhamentoPort> {
  const { sessao, repositorio, auditoria } = await montar();
  return new MarcarServicoAcompanhamento(
    sessao,
    repositorio,
    auditoria,
    new RelogioSistemaGateway(),
  );
}

export async function makeDefinirServicoAplicavel(): Promise<DefinirServicoAplicavelPort> {
  const { sessao, repositorio, auditoria } = await montar();
  return new DefinirServicoAplicavel(sessao, repositorio, auditoria, new RelogioSistemaGateway());
}

export async function makeCriarServicoAcompanhamento(): Promise<CriarServicoAcompanhamentoPort> {
  const { sessao, repositorio, auditoria } = await montar();
  return new CriarServicoAcompanhamento(sessao, repositorio, auditoria);
}

export async function makeRenomearServicoAcompanhamento(): Promise<RenomearServicoAcompanhamentoPort> {
  const { sessao, repositorio, auditoria } = await montar();
  return new RenomearServicoAcompanhamento(sessao, repositorio, auditoria);
}

export async function makeDesativarServicoAcompanhamento(): Promise<DesativarServicoAcompanhamentoPort> {
  const { sessao, repositorio, auditoria } = await montar();
  return new DesativarServicoAcompanhamento(sessao, repositorio, auditoria);
}

async function montarFolha() {
  const supabase = await createSupabaseServer();
  return {
    sessao: sessaoViaUsuarios(supabase),
    repositorio: new SupabaseFolhaDePontoRepository(supabase, errosRh),
    auditoria: auditoriaBestEffort(errosRh),
  };
}

export async function makeObterFolhaDePonto(): Promise<ObterFolhaDePontoPort> {
  const supabase = await createSupabaseServer();
  return new ObterFolhaDePonto(
    sessaoViaUsuarios(supabase),
    new SupabaseFolhaDePontoRepository(supabase, errosRh),
    new SupabaseConvencaoRepository(supabase, errosRh),
    new RelogioSistemaGateway(),
  );
}

export async function makeCadastrarEmpregado(): Promise<CadastrarEmpregadoPort> {
  const { sessao, repositorio, auditoria } = await montarFolha();
  return new CadastrarEmpregado(sessao, repositorio, auditoria);
}

export async function makeCorrigirEmpregado(): Promise<CorrigirEmpregadoPort> {
  const { sessao, repositorio, auditoria } = await montarFolha();
  return new CorrigirEmpregado(sessao, repositorio, auditoria);
}

export async function makeDefinirEmpregadoAtivo(): Promise<DefinirEmpregadoAtivoPort> {
  const { sessao, repositorio, auditoria } = await montarFolha();
  return new DefinirEmpregadoAtivo(sessao, repositorio, auditoria);
}

export async function makeDefinirSemMovimento(): Promise<DefinirSemMovimentoPort> {
  const { sessao, repositorio, auditoria } = await montarFolha();
  return new DefinirSemMovimento(sessao, repositorio, auditoria, new RelogioSistemaGateway());
}

export async function makeDefinirPadraoComissionados(): Promise<DefinirPadraoComissionadosPort> {
  const { sessao, repositorio, auditoria } = await montarFolha();
  return new DefinirPadraoComissionados(sessao, repositorio, auditoria);
}

export async function makeIniciarCartaoDoPonto(): Promise<IniciarCartaoDoPontoPort> {
  const { sessao, repositorio, auditoria } = await montarFolha();
  return new IniciarCartaoDoPonto(sessao, repositorio, auditoria, new RelogioSistemaGateway());
}

export async function makeSalvarDiaDoPonto(): Promise<SalvarDiaDoPontoPort> {
  const { sessao, repositorio, auditoria } = await montarFolha();
  return new SalvarDiaDoPonto(sessao, repositorio, auditoria, new RelogioSistemaGateway());
}

export async function makeObterConvencoesDoCliente(): Promise<ObterConvencoesDoClientePort> {
  const supabase = await createSupabaseServer();
  return new ObterConvencoesDoCliente(
    sessaoViaUsuarios(supabase),
    new SupabaseFolhaDePontoRepository(supabase, errosRh),
    new SupabaseConvencaoRepository(supabase, errosRh),
  );
}

// O PDF e a convenção vão com a sessão do usuário: a policy do bucket e a RLS repetem a regra do caso de uso.
export async function makeEnviarConvencao(): Promise<EnviarConvencaoPort> {
  const supabase = await createSupabaseServer();
  return new EnviarConvencao(
    sessaoViaUsuarios(supabase),
    new SupabaseFolhaDePontoRepository(supabase, errosRh),
    new SupabaseConvencaoRepository(supabase, errosRh),
    new SupabaseArmazenamentoDeConvencaoGateway(supabase),
    EXTRACAO_CONVENCAO_MODO === "falso"
      ? new ExtratorDeRegrasFalsoGateway()
      : new ExtratorDeRegrasIndisponivelGateway(),
    auditoriaBestEffort(errosRh),
    errosRh,
  );
}

export async function makeDefinirInterruptoresDoCliente(): Promise<DefinirInterruptoresDoClientePort> {
  const { sessao, repositorio, auditoria } = await montarFolha();
  return new DefinirInterruptoresDoCliente(sessao, repositorio, auditoria);
}

export async function makeDefinirConvencaoDoEmpregado(): Promise<DefinirConvencaoDoEmpregadoPort> {
  const { sessao, repositorio, auditoria } = await montarFolha();
  return new DefinirConvencaoDoEmpregado(sessao, repositorio, auditoria);
}
