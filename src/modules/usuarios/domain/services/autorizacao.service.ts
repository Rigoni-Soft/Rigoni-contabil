import type { Usuario } from "@/modules/usuarios/domain/entities/usuario.entity";
import type { Setor } from "@/modules/usuarios/domain/value-objects/setor.vo";

export class AutorizacaoService {
  podeAcessarSetor(usuario: Usuario, alvo: Setor): boolean {
    return usuario.papel.ehAdmin() || usuario.setor.slug === alvo.slug;
  }
}
