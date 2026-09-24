import "server-only";

import { createSupabaseServer } from "@/main/supabase-server.factory";
import type { ListarSetoresPort } from "@/modules/usuarios/application/ports/in/listar-setores.provider";
import type { LoginPort } from "@/modules/usuarios/application/ports/in/login.provider";
import type { LogoutPort } from "@/modules/usuarios/application/ports/in/logout.provider";
import type { ObterSessaoPort } from "@/modules/usuarios/application/ports/in/obter-sessao.provider";
import { ListarSetores } from "@/modules/usuarios/application/use-cases/listar-setores.use-case";
import { Login } from "@/modules/usuarios/application/use-cases/login.use-case";
import { Logout } from "@/modules/usuarios/application/use-cases/logout.use-case";
import { ObterSessao } from "@/modules/usuarios/application/use-cases/obter-sessao.use-case";
import { SupabaseSessaoGateway } from "@/modules/usuarios/infra/gateways/supabase-sessao.gateway";
import { SupabaseUsuarioRepository } from "@/modules/usuarios/infra/repositories/usuario.repository";

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

export function makeListarSetores(): ListarSetoresPort {
  return new ListarSetores();
}
