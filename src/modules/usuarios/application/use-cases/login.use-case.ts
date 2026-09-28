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
    if (!id) return this.abortarSessaoOrfa("Sessão inválida após autenticação.");

    const usuario = await this.usuarios.buscarPorId(id);
    if (!usuario) return this.abortarSessaoOrfa("Usuário autenticado sem perfil cadastrado.");

    return ok(usuarioParaDto(usuario));
  }

  // Supabase já autenticou nesse ponto: qualquer falha daqui em diante precisa
  // encerrar a sessão pra não deixá-la órfã. O resultado do próprio encerrar()
  // nunca é descartado — se ele falhar, o log do servidor registra (nunca afirma
  // "sessão encerrada" quando não foi); o navegador só recebe o erro seguro.
  private async abortarSessaoOrfa(mensagem: string): Promise<Result<UsuarioDto, AppError>> {
    const encerrado = await this.sessao.encerrar();
    if (!encerrado.ok) {
      console.error("Falha ao encerrar sessão órfã após login:", encerrado.error.message);
    }
    return err(new ForbiddenError(mensagem));
  }
}
