import type { UsuarioDto } from "@/modules/usuarios/application/dtos/usuario.dto";
import { usuarioParaDto } from "@/modules/usuarios/application/mappers/usuario-para-dto.mapper";
import type { ListarUsuariosPort } from "@/modules/usuarios/application/ports/in/listar-usuarios.provider";
import type { SessaoPort } from "@/modules/usuarios/application/ports/out/sessao.provider";
import type { UsuarioRepository } from "@/modules/usuarios/application/ports/out/usuario.repository";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok, type Result } from "@/shared/kernel/result";

export class ListarUsuarios implements ListarUsuariosPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly usuarios: UsuarioRepository,
  ) {}

  async execute(): Promise<Result<UsuarioDto[], AppError>> {
    const atorId = await this.sessao.usuarioAtualId();
    if (!atorId) return err(new ForbiddenError("Sessão inválida."));

    const perfilAtor = await this.usuarios.buscarPorId(atorId);
    if (!perfilAtor.ok) return perfilAtor;
    if (!perfilAtor.value?.papel.ehAdmin()) {
      return err(new ForbiddenError("Só Admin lista usuários."));
    }

    const ativos = await this.usuarios.listarAtivos();
    if (!ativos.ok) return ativos;
    return ok(ativos.value.map(usuarioParaDto));
  }
}
