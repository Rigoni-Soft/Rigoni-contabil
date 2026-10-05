import "server-only";

import { makeRegistrarAcao } from "@/main/auditoria.factory";
import { createSupabaseAdmin } from "@/main/supabase-admin.factory";
import { createSupabaseServer } from "@/main/supabase-server.factory";
import type { CriarUsuarioPort } from "@/modules/usuarios/application/ports/in/criar-usuario.provider";
import type { DesativarUsuarioPort } from "@/modules/usuarios/application/ports/in/desativar-usuario.provider";
import type { ListarSetoresPort } from "@/modules/usuarios/application/ports/in/listar-setores.provider";
import type { ListarUsuariosPort } from "@/modules/usuarios/application/ports/in/listar-usuarios.provider";
import type { LoginPort } from "@/modules/usuarios/application/ports/in/login.provider";
import type { LogoutPort } from "@/modules/usuarios/application/ports/in/logout.provider";
import type { ObterSessaoPort } from "@/modules/usuarios/application/ports/in/obter-sessao.provider";
import type { TrocarSenhaPort } from "@/modules/usuarios/application/ports/in/trocar-senha.provider";
import type { AuditoriaPort } from "@/modules/usuarios/application/ports/out/auditoria.provider";
import { CriarUsuario } from "@/modules/usuarios/application/use-cases/criar-usuario.use-case";
import { DesativarUsuario } from "@/modules/usuarios/application/use-cases/desativar-usuario.use-case";
import { ListarSetores } from "@/modules/usuarios/application/use-cases/listar-setores.use-case";
import { ListarUsuarios } from "@/modules/usuarios/application/use-cases/listar-usuarios.use-case";
import { Login } from "@/modules/usuarios/application/use-cases/login.use-case";
import { Logout } from "@/modules/usuarios/application/use-cases/logout.use-case";
import { ObterSessao } from "@/modules/usuarios/application/use-cases/obter-sessao.use-case";
import { TrocarSenha } from "@/modules/usuarios/application/use-cases/trocar-senha.use-case";
import { AutorizacaoService } from "@/modules/usuarios/domain/services/autorizacao.service";
import { SupabaseAuthAdminGateway } from "@/modules/usuarios/infra/gateways/supabase-auth-admin.gateway";
import { SupabaseDesativacaoGateway } from "@/modules/usuarios/infra/gateways/supabase-desativacao.gateway";
import { SupabaseFinalizarTrocaSenhaGateway } from "@/modules/usuarios/infra/gateways/supabase-finalizar-troca-senha.gateway";
import { SupabaseSessaoGateway } from "@/modules/usuarios/infra/gateways/supabase-sessao.gateway";
import { SupabaseUsuarioRepository } from "@/modules/usuarios/infra/repositories/usuario.repository";
import { err, ok } from "@/shared/kernel/result";

// Adapta a porta IN RegistrarAcao (módulo auditoria) à porta própria de usuarios
// (arquitetura.md, seção 3.11). Devolutiva técnica PR #61, ponto 2: devolve o
// Result de verdade — quem chama (CriarUsuario) decide se trata como fatal.
function auditoriaViaModuloAuditoria(): AuditoriaPort {
  return {
    registrar: async (input) => {
      const registrarAcao = await makeRegistrarAcao();
      const resultado = await registrarAcao.execute(input);
      if (!resultado.ok) return err(resultado.error);
      return ok(undefined);
    },
  };
}

export async function makeLogin(): Promise<LoginPort> {
  const supabase = await createSupabaseServer();
  return new Login(new SupabaseSessaoGateway(supabase), new SupabaseUsuarioRepository(supabase));
}

export async function makeLogout(): Promise<LogoutPort> {
  const supabase = await createSupabaseServer();
  return new Logout(new SupabaseSessaoGateway(supabase));
}

export async function makeObterSessao(): Promise<ObterSessaoPort> {
  const supabase = await createSupabaseServer();
  return new ObterSessao(
    new SupabaseSessaoGateway(supabase),
    new SupabaseUsuarioRepository(supabase),
  );
}

export async function makeListarSetores(): Promise<ListarSetoresPort> {
  const supabase = await createSupabaseServer();
  return new ListarSetores(
    new SupabaseSessaoGateway(supabase),
    new SupabaseUsuarioRepository(supabase),
    new AutorizacaoService(),
  );
}

export async function makeCriarUsuario(): Promise<CriarUsuarioPort> {
  const supabase = await createSupabaseServer();
  return new CriarUsuario(
    new SupabaseSessaoGateway(supabase),
    new SupabaseUsuarioRepository(supabase),
    new SupabaseAuthAdminGateway(createSupabaseAdmin()),
    auditoriaViaModuloAuditoria(),
    new AutorizacaoService(),
  );
}

export async function makeTrocarSenha(): Promise<TrocarSenhaPort> {
  const supabase = await createSupabaseServer();
  return new TrocarSenha(
    new SupabaseSessaoGateway(supabase),
    new SupabaseUsuarioRepository(supabase),
    new SupabaseFinalizarTrocaSenhaGateway(createSupabaseAdmin()),
    auditoriaViaModuloAuditoria(),
  );
}

export async function makeListarUsuarios(): Promise<ListarUsuariosPort> {
  const supabase = await createSupabaseServer();
  return new ListarUsuarios(
    new SupabaseSessaoGateway(supabase),
    new SupabaseUsuarioRepository(supabase),
  );
}

export async function makeDesativarUsuario(): Promise<DesativarUsuarioPort> {
  const supabase = await createSupabaseServer();
  const supabaseAdmin = createSupabaseAdmin();
  return new DesativarUsuario(
    new SupabaseSessaoGateway(supabase),
    new SupabaseUsuarioRepository(supabase),
    new SupabaseDesativacaoGateway(supabaseAdmin),
    new SupabaseAuthAdminGateway(supabaseAdmin),
  );
}
