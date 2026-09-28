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

    // Erro do Postgres (rede, indisponibilidade, id malformado) nunca vira exceção
    // aqui: quem chama (Login, ObterSessao) trata ausência de perfil como sessão
    // inválida e precisa poder reagir sem try/catch (arquitetura.md, seção 3.8).
    // Detalhe fica só no log do servidor, mesmo contrato do SupabaseSessaoGateway.
    if (error) {
      console.error(`Falha ao buscar perfil (id=${id}):`, error.message);
      return null;
    }
    if (!data) return null;

    const row = perfilRowSchema.parse(data);
    const resultado = perfilParaUsuario(row);
    if (!resultado.ok)
      throw new Error(`Perfil salvo com dados inválidos (id=${id}): ${resultado.error.message}`);

    return resultado.value;
  }
}
