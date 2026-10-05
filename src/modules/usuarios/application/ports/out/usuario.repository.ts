import type { Usuario, UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import type { Setor } from "@/modules/usuarios/domain/value-objects/setor.vo";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export interface UsuarioRepository {
  // Erro técnico (Postgres indisponível, id malformado) nunca vira `null`: colidiria
  // com "perfil inexistente"/RLS ocultando a linha (arquitetura.md §3.8, devolutiva #55).
  buscarPorId(id: UsuarioId): Promise<Result<Usuario | null, AppError>>;
  criar(usuario: Usuario): Promise<Result<void, AppError>>;
  // Só contas ativas (#58). RLS decide quem enxerga o quê — Admin vê todas.
  listarAtivos(): Promise<Result<Usuario[], AppError>>;
  // Líder de setor não desativado do Setor, ou null (#57).
  buscarLiderAtivoDoSetor(setor: Setor): Promise<Result<Usuario | null, AppError>>;
}
