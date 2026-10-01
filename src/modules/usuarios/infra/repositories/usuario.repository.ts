import type { SupabaseClient } from "@supabase/supabase-js";

import type { UsuarioRepository } from "@/modules/usuarios/application/ports/out/usuario.repository";
import type { Usuario, UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import { perfilRowSchema } from "@/modules/usuarios/infra/dtos/perfil-row.dto";
import { perfilParaUsuario } from "@/modules/usuarios/infra/mappers/perfil-para-usuario.mapper";
import { AppError } from "@/shared/errors/app.error";
import { err, ok, type Result } from "@/shared/kernel/result";

class PersistenciaError extends AppError {
  readonly code = "PERSISTENCIA_ERROR";
}

export class SupabaseUsuarioRepository implements UsuarioRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async buscarPorId(id: UsuarioId): Promise<Result<Usuario | null, AppError>> {
    const { data, error } = await this.supabase
      .from("perfis")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    // Erro do Postgres (rede, indisponibilidade, id malformado) é falha técnica,
    // distinta de ausência: devolvê-lo como `null` colidiria com "perfil inexistente"
    // ou "oculto pela RLS" (devolutiva #55, ponto 02). Detalhe fica só no log do
    // servidor; quem chama decide como apresentar o erro sem expô-lo.
    if (error) {
      const mensagem = `Falha ao buscar perfil (id=${id}): ${error.message}`;
      console.error(mensagem);
      return err(new PersistenciaError(mensagem));
    }
    if (!data) return ok(null);

    // Row DTO: formato exato da tabela, validado por Zod — falha alto se o banco
    // divergir do schema esperado (arquitetura.md §3.7, bug/estado impossível).
    const row = perfilRowSchema.parse(data);

    // Diferente do `parse` acima: aqui é regra de negócio (nome/e-mail válidos),
    // não formato da coluna — dado sujo é falha esperada, não bug (arquitetura.md
    // §3.8), e precisa devolver Result pra quem chama poder limpar a sessão sem
    // depender de try/catch (devolutiva #55, ponto 01).
    const resultado = perfilParaUsuario(row);
    if (!resultado.ok) {
      const mensagem = `Perfil salvo com dados inválidos (id=${id}): ${resultado.error.message}`;
      console.error(mensagem);
      return err(new PersistenciaError(mensagem));
    }

    return ok(resultado.value);
  }

  async criar(usuario: Usuario): Promise<Result<void, AppError>> {
    const { error } = await this.supabase.from("perfis").insert({
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      papel: usuario.papel.valor,
      setor: usuario.setor.slug,
    });

    if (error) return err(new PersistenciaError(`Falha ao salvar perfil: ${error.message}`));
    return ok(undefined);
  }
}
