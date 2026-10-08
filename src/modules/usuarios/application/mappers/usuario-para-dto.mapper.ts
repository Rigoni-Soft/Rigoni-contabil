import type { UsuarioDto } from "@/modules/usuarios/application/dtos/usuario.dto";
import type { Usuario } from "@/modules/usuarios/domain/entities/usuario.entity";

export function usuarioParaDto(usuario: Usuario): UsuarioDto {
  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    papel: usuario.papel.valor,
    setor: usuario.setor.slug,
    precisaTrocarSenha: usuario.precisaTrocarSenha(),
    bloqueioPendente: usuario.bloqueioPendente(),
  };
}
