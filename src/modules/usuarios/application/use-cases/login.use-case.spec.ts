import type { SessaoPort } from "@/modules/usuarios/application/ports/out/sessao.provider";
import type { UsuarioRepository } from "@/modules/usuarios/application/ports/out/usuario.repository";
import { Usuario, type UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok, type Result } from "@/shared/kernel/result";

import { Login } from "./login.use-case";

function usuarioFalso(id: string): Usuario {
  const resultado = Usuario.builder()
    .comId(id)
    .comNome("Admin")
    .comEmail("admin@rigonicontabil.local")
    .comPapel("admin")
    .comSetor("administrativo")
    .build();
  if (!resultado.ok) throw new Error("setup inválido");
  return resultado.value;
}

class SessaoFalsa implements SessaoPort {
  credenciaisValidas = true;
  idAposLogin: UsuarioId | null = "11111111-1111-1111-1111-111111111111" as UsuarioId;

  async autenticar(): Promise<Result<void, AppError>> {
    return this.credenciaisValidas
      ? ok(undefined)
      : err(new ForbiddenError("credenciais inválidas"));
  }
  async encerrar(): Promise<void> {}
  async usuarioAtualId(): Promise<UsuarioId | null> {
    return this.idAposLogin;
  }
}

class UsuarioRepositoryFalso implements UsuarioRepository {
  usuario: Usuario | null = null;
  async buscarPorId(): Promise<Usuario | null> {
    return this.usuario;
  }
}

describe("Login", () => {
  it("autentica e devolve o UsuarioDto quando as credenciais e o perfil existem", async () => {
    const sessao = new SessaoFalsa();
    const repositorio = new UsuarioRepositoryFalso();
    repositorio.usuario = usuarioFalso("11111111-1111-1111-1111-111111111111");

    const resultado = await new Login(sessao, repositorio).execute({
      email: "admin@rigonicontabil.local",
      senha: "admin123",
    });

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.value.papel).toBe("admin");
  });

  it("devolve erro quando as credenciais são inválidas", async () => {
    const sessao = new SessaoFalsa();
    sessao.credenciaisValidas = false;
    const repositorio = new UsuarioRepositoryFalso();

    const resultado = await new Login(sessao, repositorio).execute({
      email: "x@x.com",
      senha: "errada",
    });

    expect(resultado.ok).toBe(false);
  });

  it("devolve erro quando o usuário autenticado não tem perfil cadastrado", async () => {
    const sessao = new SessaoFalsa();
    const repositorio = new UsuarioRepositoryFalso();
    repositorio.usuario = null;

    const resultado = await new Login(sessao, repositorio).execute({
      email: "sem-perfil@rigonicontabil.local",
      senha: "123456",
    });

    expect(resultado.ok).toBe(false);
  });
});
