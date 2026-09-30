import "server-only";

import { createSupabaseServer } from "@/main/supabase-server.factory";
import { makeObterSessao } from "@/main/usuarios.factory";
import type { ListarRegistrosPort } from "@/modules/auditoria/application/ports/in/listar-registros.provider";
import type { RegistrarAcaoPort } from "@/modules/auditoria/application/ports/in/registrar-acao.provider";
import type { SessaoPort } from "@/modules/auditoria/application/ports/out/sessao.provider";
import { ListarRegistros } from "@/modules/auditoria/application/use-cases/listar-registros.use-case";
import { RegistrarAcao } from "@/modules/auditoria/application/use-cases/registrar-acao.use-case";
import { SupabaseRegistroAcaoRepository } from "@/modules/auditoria/infra/repositories/registro-acao.repository";

// Adapta a sessão do módulo usuarios à porta própria da auditoria (arquitetura.md, seção 3.11):
// só o `main` enxerga os dois módulos.
async function sessaoViaUsuarios(): Promise<SessaoPort> {
  const obterSessao = await makeObterSessao();
  return { usuarioAtual: () => obterSessao.execute() };
}

export async function makeRegistrarAcao(): Promise<RegistrarAcaoPort> {
  const supabase = await createSupabaseServer();
  return new RegistrarAcao(new SupabaseRegistroAcaoRepository(supabase));
}

export async function makeListarRegistros(): Promise<ListarRegistrosPort> {
  const supabase = await createSupabaseServer();
  return new ListarRegistros(
    new SupabaseRegistroAcaoRepository(supabase),
    await sessaoViaUsuarios(),
  );
}
