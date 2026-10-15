import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdmin } from "@/main/supabase-admin.factory";
import { createSupabaseServer } from "@/main/supabase-server.factory";
import type { ListarRegistrosPort } from "@/modules/auditoria/application/ports/in/listar-registros.provider";
import type { RegistrarAcaoPort } from "@/modules/auditoria/application/ports/in/registrar-acao.provider";
import type { SessaoPort } from "@/modules/auditoria/application/ports/out/sessao.provider";
import { ListarRegistros } from "@/modules/auditoria/application/use-cases/listar-registros.use-case";
import { RegistrarAcao } from "@/modules/auditoria/application/use-cases/registrar-acao.use-case";
import { SupabaseRegistroAcaoRepository } from "@/modules/auditoria/infra/repositories/registro-acao.repository";
import { ObterSessao } from "@/modules/usuarios/application/use-cases/obter-sessao.use-case";
import { SupabaseSessaoGateway } from "@/modules/usuarios/infra/gateways/supabase-sessao.gateway";
import { SupabaseUsuarioRepository } from "@/modules/usuarios/infra/repositories/usuario.repository";

// Adapta a sessão do módulo usuarios à porta própria da auditoria (arquitetura.md, seção 3.11):
// só o `main` enxerga os dois módulos. Monta o ObterSessao direto (não chama
// usuarios.factory) pra não criar import circular entre as duas factories,
// já que usuarios.factory também precisa desta (makeRegistrarAcao).
function sessaoViaUsuarios(supabase: SupabaseClient): SessaoPort {
  const obterSessao = new ObterSessao(
    new SupabaseSessaoGateway(supabase),
    new SupabaseUsuarioRepository(supabase),
  );
  return { usuarioAtual: () => obterSessao.execute() };
}

// Client service_role, não o da sessão do usuário: a RPC registrar_acao_auditoria só aceita
// service_role (migration 20260924190000_usuarios_e_auditoria.sql), justamente pra um usuário comum não conseguir chamá-la
// direto e fabricar eventos. Mesmo padrão do SupabaseAuthAdminGateway (ADR 0001): privilégio
// elevado confinado a um único ponto.
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
