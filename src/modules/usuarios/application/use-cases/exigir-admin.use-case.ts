import type { SessaoPort } from "@/modules/usuarios/application/ports/out/sessao.provider";
import type { UsuarioRepository } from "@/modules/usuarios/application/ports/out/usuario.repository";
import type { Usuario } from "@/modules/usuarios/domain/entities/usuario.entity";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok, type Result } from "@/shared/kernel/result";

export async function exigirAdmin(
  sessao: SessaoPort,
  usuarios: UsuarioRepository,
  mensagemForbidden: string,
): Promise<Result<Usuario, AppError>> {
  const atorId = await sessao.usuarioAtualId();
  if (!atorId) return err(new ForbiddenError("Sessão inválida."));

  const perfil = await usuarios.buscarPorId(atorId);
  if (!perfil.ok) return perfil;
  if (!perfil.value?.papel.ehAdmin() || perfil.value.estaDesativado())
    return err(new ForbiddenError(mensagemForbidden));
  return ok(perfil.value);
}
