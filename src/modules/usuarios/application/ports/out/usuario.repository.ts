import type { Usuario, UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";

export interface UsuarioRepository {
  buscarPorId(id: UsuarioId): Promise<Usuario | null>;
}
