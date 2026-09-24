import type { UsuarioDto } from "@/modules/usuarios/application/dtos/usuario.dto";
import { usuarioParaDto } from "@/modules/usuarios/application/mappers/usuario-para-dto.mapper";
import type { LoginInput, LoginPort } from "@/modules/usuarios/application/ports/in/login.provider";
import type { SessaoPort } from "@/modules/usuarios/application/ports/out/sessao.provider";
import type { UsuarioRepository } from "@/modules/usuarios/application/ports/out/usuario.repository";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok, type Result } from "@/shared/kernel/result";

export class Login implements LoginPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly usuarios: UsuarioRepository,
  ) {}

  async execute({ email, senha }: LoginInput): Promise<Result<UsuarioDto, AppError>> {
    const autenticado = await this.sessao.autenticar(email, senha);
    if (!autenticado.ok) return autenticado;

    const id = await this.sessao.usuarioAtualId();
    if (!id) return err(new ForbiddenError("Sessão inválida após autenticação."));

    const usuario = await this.usuarios.buscarPorId(id);
    if (!usuario) return err(new ForbiddenError("Usuário autenticado sem perfil cadastrado."));

    return ok(usuarioParaDto(usuario));
  }
}
