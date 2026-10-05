import type { UsuarioDto } from "@/modules/usuarios/application/dtos/usuario.dto";
import { usuarioParaDto } from "@/modules/usuarios/application/mappers/usuario-para-dto.mapper";
import type { ListarUsuariosPort } from "@/modules/usuarios/application/ports/in/listar-usuarios.provider";
import type { SessaoPort } from "@/modules/usuarios/application/ports/out/sessao.provider";
import type { UsuarioRepository } from "@/modules/usuarios/application/ports/out/usuario.repository";
import { exigirAdmin } from "@/modules/usuarios/application/use-cases/exigir-admin.use-case";
import type { AppError } from "@/shared/errors/app.error";
import { ok, type Result } from "@/shared/kernel/result";

export class ListarUsuarios implements ListarUsuariosPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly usuarios: UsuarioRepository,
  ) {}

  async execute(): Promise<Result<UsuarioDto[], AppError>> {
    const ator = await exigirAdmin(this.sessao, this.usuarios, "Só Admin lista usuários.");
    if (!ator.ok) return ator;

    const ativos = await this.usuarios.listarAtivos();
    if (!ativos.ok) return ativos;
    return ok(ativos.value.map(usuarioParaDto));
  }
}
