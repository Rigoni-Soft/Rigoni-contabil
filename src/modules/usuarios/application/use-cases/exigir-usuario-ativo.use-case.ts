import type { SessaoPort } from "@/modules/usuarios/application/ports/out/sessao.provider";
import type { UsuarioRepository } from "@/modules/usuarios/application/ports/out/usuario.repository";
import type { Usuario } from "@/modules/usuarios/domain/entities/usuario.entity";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok, type Result } from "@/shared/kernel/result";

export async function exigirUsuarioAtivo(
  sessao: SessaoPort,
  usuarios: UsuarioRepository,
): Promise<Result<Usuario, AppError>> {
  const id = await sessao.usuarioAtualId();
  if (!id) return err(new ForbiddenError("Sessão inválida."));

  const perfil = await usuarios.buscarPorId(id);
  if (!perfil.ok) return perfil;
  if (!perfil.value) return err(new ForbiddenError("Usuário autenticado sem perfil cadastrado."));
  if (perfil.value.estaDesativado()) return err(new ForbiddenError("Conta desativada."));
  return ok(perfil.value);
}
