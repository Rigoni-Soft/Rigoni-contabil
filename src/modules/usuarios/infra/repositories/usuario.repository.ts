import type { SupabaseClient } from "@supabase/supabase-js";

import type { UsuarioRepository } from "@/modules/usuarios/application/ports/out/usuario.repository";
import type { Usuario, UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import type { Setor } from "@/modules/usuarios/domain/value-objects/setor.vo";
import { perfilRowSchema } from "@/modules/usuarios/infra/dtos/perfil-row.dto";
import { perfilParaUsuario } from "@/modules/usuarios/infra/mappers/perfil-para-usuario.mapper";
import type { AppError } from "@/shared/errors/app.error";
import { PersistenciaError } from "@/shared/errors/persistencia.error";
import { err, ok, type Result } from "@/shared/kernel/result";

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
    // ou "oculto pela RLS". Detalhe fica só no log do servidor; quem chama decide
    // como apresentar o erro sem expô-lo.
    if (error) {
      const mensagem = `Falha ao buscar perfil (id=${id}): ${error.message}`;
      console.error(mensagem);
      return err(new PersistenciaError(mensagem));
    }
    if (!data) return ok(null);

    return this.paraUsuario(data);
  }

  async listarAtivos(): Promise<Result<Usuario[], AppError>> {
    const { data, error } = await this.supabase
      .from("perfis")
      .select("*")
      .is("desativado_em", null)
      .order("nome");
    if (error) {
      console.error(`Falha ao listar perfis: ${error.message}`);
      return err(new PersistenciaError("Falha ao listar usuários."));
    }

    return this.paraUsuarios(data);
  }

  async listarComBloqueioPendente(): Promise<Result<Usuario[], AppError>> {
    const { data, error } = await this.supabase
      .from("perfis")
      .select("*")
      .not("desativado_em", "is", null)
      .is("banido_em", null)
      .order("nome");
    if (error) {
      console.error(`Falha ao listar bloqueios pendentes: ${error.message}`);
      return err(new PersistenciaError("Falha ao listar usuários."));
    }
    return this.paraUsuarios(data);
  }

  private paraUsuarios(rows: unknown[]): Result<Usuario[], AppError> {
    const usuarios: Usuario[] = [];
    for (const row of rows) {
      const usuario = this.paraUsuario(row);
      if (!usuario.ok) return err(new PersistenciaError("Falha ao listar usuários."));
      usuarios.push(usuario.value);
    }
    return ok(usuarios);
  }

  async buscarLiderAtivoDoSetor(setor: Setor): Promise<Result<Usuario | null, AppError>> {
    const { data, error } = await this.supabase
      .from("perfis")
      .select("*")
      .eq("setor", setor.slug)
      .eq("papel", "lider_setor")
      .is("desativado_em", null)
      .maybeSingle();
    if (error) {
      console.error(`Falha ao buscar líder do setor ${setor.slug}: ${error.message}`);
      return err(new PersistenciaError("Falha ao verificar o líder do setor."));
    }
    return data ? this.paraUsuario(data) : ok(null);
  }

  // Row DTO: formato exato da tabela, validado por Zod — falha alto se o banco
  // divergir do schema esperado (arquitetura.md §3.7, bug/estado impossível).
  // Já a reconstrução de domínio (nome/e-mail válidos) é regra de negócio: dado
  // sujo é falha esperada, não bug (§3.8), e devolve Result pra quem chama poder
  // limpar a sessão sem try/catch.
  private paraUsuario(data: unknown): Result<Usuario, AppError> {
    const row = perfilRowSchema.parse(data);
    const resultado = perfilParaUsuario(row);
    if (!resultado.ok) {
      const mensagem = `Perfil salvo com dados inválidos (id=${row.id}): ${resultado.error.message}`;
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
