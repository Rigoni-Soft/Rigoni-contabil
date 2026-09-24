import type { SupabaseClient } from "@supabase/supabase-js";

import type { UsuarioRepository } from "@/modules/usuarios/application/ports/out/usuario.repository";
import type { Usuario, UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import { perfilRowSchema } from "@/modules/usuarios/infra/dtos/perfil-row.dto";
import { perfilParaUsuario } from "@/modules/usuarios/infra/mappers/perfil-para-usuario.mapper";

export class SupabaseUsuarioRepository implements UsuarioRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async buscarPorId(id: UsuarioId): Promise<Usuario | null> {
    const { data, error } = await this.supabase
      .from("perfis")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(`Falha ao buscar perfil (id=${id}): ${error.message}`);
    if (!data) return null;

    const row = perfilRowSchema.parse(data);
    const resultado = perfilParaUsuario(row);
    if (!resultado.ok)
      throw new Error(`Perfil salvo com dados inválidos (id=${id}): ${resultado.error.message}`);

    return resultado.value;
  }
}
