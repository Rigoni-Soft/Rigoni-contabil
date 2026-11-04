import { ConsoleRegistroDeErrosGateway as ConsoleUsuarios } from "@/modules/usuarios/infra/gateways/console-registro-de-erros.gateway";

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { auditoriaBestEffort } from "@/main/auditoria.factory";
import { createSupabaseServer } from "@/main/supabase-server.factory";
import type {
  CriarServicoAcompanhamentoPort,
  DesativarServicoAcompanhamentoPort,
  RenomearServicoAcompanhamentoPort,
} from "@/modules/rh/application/ports/in/gerir-servico-acompanhamento.provider";
import type {
  DefinirServicoAplicavelPort,
  MarcarServicoAcompanhamentoPort,
} from "@/modules/rh/application/ports/in/marcar-servico-acompanhamento.provider";
import type { ObterAcompanhamentoMensalPort } from "@/modules/rh/application/ports/in/obter-acompanhamento-mensal.provider";
import type {
  AtorSessaoDto,
  SessaoPort,
} from "@/modules/rh/application/ports/out/sessao.provider";
import {
  CriarServicoAcompanhamento,
  DesativarServicoAcompanhamento,
  RenomearServicoAcompanhamento,
} from "@/modules/rh/application/use-cases/gerir-servico-acompanhamento.use-case";
import {
  DefinirServicoAplicavel,
  MarcarServicoAcompanhamento,
} from "@/modules/rh/application/use-cases/marcar-servico-acompanhamento.use-case";
import { ObterAcompanhamentoMensal } from "@/modules/rh/application/use-cases/obter-acompanhamento-mensal.use-case";
import { ConsoleRegistroDeErrosGateway as ConsoleRh } from "@/modules/rh/infra/gateways/console-registro-de-erros.gateway";
import { RelogioSistemaGateway } from "@/modules/rh/infra/gateways/relogio-sistema.gateway";
import { SupabaseAcompanhamentoRepository } from "@/modules/rh/infra/repositories/acompanhamento.repository";
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

export async function makeMarcarServicoAcompanhamento(): Promise<MarcarServicoAcompanhamentoPort> {
  const { sessao, repositorio, auditoria } = await montar();
  return new MarcarServicoAcompanhamento(sessao, repositorio, auditoria, new RelogioSistemaGateway());
}

export async function makeDefinirServicoAplicavel(): Promise<DefinirServicoAplicavelPort> {
  const { sessao, repositorio, auditoria } = await montar();
  return new DefinirServicoAplicavel(sessao, repositorio, auditoria);
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
