import type { SessaoPort } from "@/modules/usuarios/application/ports/out/sessao.provider";
import type { UsuarioRepository } from "@/modules/usuarios/application/ports/out/usuario.repository";
import type { Usuario } from "@/modules/usuarios/domain/entities/usuario.entity";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok, type Result } from "@/shared/kernel/result";

// Passo comum dos casos de uso exclusivos de Admin: sessão válida + perfil Admin. Erro técnico ao
// buscar o perfil propaga o AppError original, nunca vira "sem permissão".
export async function exigirAdmin(
  sessao: SessaoPort,
  usuarios: UsuarioRepository,
  mensagemForbidden: string,
): Promise<Result<Usuario, AppError>> {
  const atorId = await sessao.usuarioAtualId();
  if (!atorId) return err(new ForbiddenError("Sessão inválida."));

  const perfil = await usuarios.buscarPorId(atorId);
  if (!perfil.ok) return perfil;
  // JWT de conta desativada vale até expirar; o perfil é a fonte da verdade.
  if (!perfil.value?.papel.ehAdmin() || perfil.value.estaDesativado())
    return err(new ForbiddenError(mensagemForbidden));
  return ok(perfil.value);
}
