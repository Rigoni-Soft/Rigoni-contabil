import type { UsuarioDto } from "@/modules/usuarios/application/dtos/usuario.dto";
import { usuarioParaDto } from "@/modules/usuarios/application/mappers/usuario-para-dto.mapper";
import type { LoginInput, LoginPort } from "@/modules/usuarios/application/ports/in/login.provider";
import type { RegistroDeErrosPort } from "@/modules/usuarios/application/ports/out/registro-de-erros.provider";
import type { SessaoPort } from "@/modules/usuarios/application/ports/out/sessao.provider";
import type { UsuarioRepository } from "@/modules/usuarios/application/ports/out/usuario.repository";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok, type Result } from "@/shared/kernel/result";

export class Login implements LoginPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly usuarios: UsuarioRepository,
    private readonly erros: RegistroDeErrosPort,
  ) {}

  async execute({ email, senha }: LoginInput): Promise<Result<UsuarioDto, AppError>> {
    const autenticado = await this.sessao.autenticar(email, senha);
    if (!autenticado.ok) return autenticado;

    const id = await this.sessao.usuarioAtualId();
    if (!id) return this.abortarSessaoOrfa("Sessão inválida após autenticação.");

    const perfil = await this.usuarios.buscarPorId(id);
    if (!perfil.ok) {
      return this.abortarSessaoOrfa("Falha ao carregar seu perfil. Tente novamente.", perfil.error);
    }
    if (!perfil.value) return this.abortarSessaoOrfa("Usuário autenticado sem perfil cadastrado.");
    const usuario = perfil.value;

    if (usuario.senhaProvisoriaVencida(new Date())) {
      return this.abortarSessaoOrfa("Senha provisória expirada. Peça ao Admin uma nova conta.");
    }

    if (usuario.estaDesativado()) return this.abortarSessaoOrfa("Conta desativada.");

    return ok(usuarioParaDto(usuario));
  }

  private async abortarSessaoOrfa(
    mensagem: string,
    detalheTecnico?: AppError,
  ): Promise<Result<UsuarioDto, AppError>> {
    if (detalheTecnico) {
      this.erros.registrar("Falha ao carregar perfil durante login:", detalheTecnico.message);
    }
    const encerrado = await this.sessao.encerrar();
    if (!encerrado.ok) {
      this.erros.registrar("Falha ao encerrar sessão órfã após login:", encerrado.error.message);
    }
    return err(new ForbiddenError(mensagem));
  }
}
