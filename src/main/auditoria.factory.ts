import { ConsoleRegistroDeErrosGateway } from "@/modules/usuarios/infra/gateways/console-registro-de-erros.gateway";

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdmin } from "@/main/supabase-admin.factory";
import { createSupabaseServer } from "@/main/supabase-server.factory";
import type { ListarRegistrosPort } from "@/modules/auditoria/application/ports/in/listar-registros.provider";
import type {
  RegistrarAcaoInput,
  RegistrarAcaoPort,
} from "@/modules/auditoria/application/ports/in/registrar-acao.provider";
import type { SessaoPort } from "@/modules/auditoria/application/ports/out/sessao.provider";
import { ListarRegistros } from "@/modules/auditoria/application/use-cases/listar-registros.use-case";
import { RegistrarAcao } from "@/modules/auditoria/application/use-cases/registrar-acao.use-case";
import { SupabaseRegistroAcaoRepository } from "@/modules/auditoria/infra/repositories/registro-acao.repository";
import type { RegistroDeErrosPort } from "@/modules/usuarios/application/ports/out/registro-de-erros.provider";
import { ObterSessao } from "@/modules/usuarios/application/use-cases/obter-sessao.use-case";
import { SupabaseSessaoGateway } from "@/modules/usuarios/infra/gateways/supabase-sessao.gateway";
import { SupabaseUsuarioRepository } from "@/modules/usuarios/infra/repositories/usuario.repository";

const errosUsuarios = new ConsoleRegistroDeErrosGateway();

function sessaoViaUsuarios(supabase: SupabaseClient): SessaoPort {
  const obterSessao = new ObterSessao(
    new SupabaseSessaoGateway(supabase),
    new SupabaseUsuarioRepository(supabase),
    errosUsuarios,
  );
  return { usuarioAtual: () => obterSessao.execute() };
}

export async function makeRegistrarAcao(): Promise<RegistrarAcaoPort> {
  return new RegistrarAcao(new SupabaseRegistroAcaoRepository(createSupabaseAdmin()));
}

export async function makeListarRegistros(): Promise<ListarRegistrosPort> {
  const supabase = await createSupabaseServer();
  return new ListarRegistros(
    new SupabaseRegistroAcaoRepository(supabase),
    sessaoViaUsuarios(supabase),
  );
}

export function auditoriaBestEffort(erros: RegistroDeErrosPort) {
  return {
    registrar: async (input: RegistrarAcaoInput): Promise<void> => {
      const resultado = await (await makeRegistrarAcao()).execute(input);
      if (!resultado.ok) erros.registrar("Falha ao registrar auditoria:", resultado.error.message);
    },
  };
}
