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
  encerrada = false;
  falhaAoEncerrar = false;

  async autenticar(): Promise<Result<void, AppError>> {
    return this.credenciaisValidas
      ? ok(undefined)
      : err(new ForbiddenError("credenciais inválidas"));
  }
  async encerrar(): Promise<Result<void, AppError>> {
    this.encerrada = true;
    if (this.falhaAoEncerrar) return err(new ForbiddenError("falha ao encerrar no Supabase"));
    return ok(undefined);
  }
  async usuarioAtualId(): Promise<UsuarioId | null> {
    return this.idAposLogin;
  }
  async trocarSenha(): Promise<Result<void, AppError>> {
    return ok(undefined);
  }
}

class UsuarioRepositoryFalso implements UsuarioRepository {
  usuario: Usuario | null = null;
  erroTecnico: AppError | null = null;
  async buscarPorId(): Promise<Result<Usuario | null, AppError>> {
    return this.erroTecnico ? err(this.erroTecnico) : ok(this.usuario);
  }
  async buscarLiderAtivoDoSetor(): Promise<Result<Usuario | null, AppError>> {
    return ok(null);
  }
  async listarAtivos(): Promise<Result<Usuario[], AppError>> {
    return ok([]);
  }
  async criar(): Promise<Result<void, AppError>> {
    return ok(undefined);
  }
  async marcarSenhaTrocada(): Promise<Result<void, AppError>> {
    return ok(undefined);
  }
}

function usuarioComSenhaProvisoria(id: string, expiraEm: Date): Usuario {
  const resultado = Usuario.builder()
    .comId(id)
    .comNome("Admin")
    .comEmail("admin@rigonicontabil.local")
    .comPapel("admin")
    .comSetor("administrativo")
    .comSenhaTrocadaEm(null)
    .comSenhaProvisoriaExpiraEm(expiraEm.toISOString())
    .build();
  if (!resultado.ok) throw new Error("setup inválido");
  return resultado.value;
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

  it("encerra a sessão do Supabase quando o perfil não existe (não deixa sessão autenticada órfã)", async () => {
    const sessao = new SessaoFalsa();
    const repositorio = new UsuarioRepositoryFalso();
    repositorio.usuario = null;

    await new Login(sessao, repositorio).execute({
      email: "sem-perfil@rigonicontabil.local",
      senha: "123456",
    });

    expect(sessao.encerrada).toBe(true);
  });

  it("encerra a sessão e devolve erro sem mencionar 'sem perfil cadastrado' quando buscarPorId falha por erro técnico (devolutiva #55, pontos 01 e 02)", async () => {
    const sessao = new SessaoFalsa();
    const repositorio = new UsuarioRepositoryFalso();
    repositorio.erroTecnico = new ForbiddenError("Falha ao buscar perfil: conexão recusada");

    const resultado = await new Login(sessao, repositorio).execute({
      email: "admin@rigonicontabil.local",
      senha: "admin123",
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error.message).not.toMatch(/sem perfil cadastrado/);
    expect(sessao.encerrada).toBe(true);
  });

  it("encerra a sessão do Supabase quando não consegue obter o id após autenticar", async () => {
    const sessao = new SessaoFalsa();
    sessao.idAposLogin = null;
    const repositorio = new UsuarioRepositoryFalso();

    await new Login(sessao, repositorio).execute({
      email: "admin@rigonicontabil.local",
      senha: "admin123",
    });

    expect(sessao.encerrada).toBe(true);
  });

  it("mesmo quando o próprio encerrar() falha, devolve erro seguro em vez de travar", async () => {
    const sessao = new SessaoFalsa();
    sessao.idAposLogin = null;
    sessao.falhaAoEncerrar = true;
    const repositorio = new UsuarioRepositoryFalso();

    const resultado = await new Login(sessao, repositorio).execute({
      email: "admin@rigonicontabil.local",
      senha: "admin123",
    });

    expect(resultado.ok).toBe(false);
    expect(sessao.encerrada).toBe(true);
  });

  it("não encerra a sessão quando o login é bem-sucedido", async () => {
    const sessao = new SessaoFalsa();
    const repositorio = new UsuarioRepositoryFalso();
    repositorio.usuario = usuarioFalso("11111111-1111-1111-1111-111111111111");

    await new Login(sessao, repositorio).execute({
      email: "admin@rigonicontabil.local",
      senha: "admin123",
    });

    expect(sessao.encerrada).toBe(false);
  });

  it("bloqueia e encerra a sessão quando a senha provisória está vencida", async () => {
    const sessao = new SessaoFalsa();
    const repositorio = new UsuarioRepositoryFalso();
    const vencida = new Date(Date.now() - 1000);
    repositorio.usuario = usuarioComSenhaProvisoria(
      "11111111-1111-1111-1111-111111111111",
      vencida,
    );

    const resultado = await new Login(sessao, repositorio).execute({
      email: "admin@rigonicontabil.local",
      senha: "admin123",
    });

    expect(resultado.ok).toBe(false);
    expect(sessao.encerrada).toBe(true);
  });

  it("autentica normalmente quando a senha provisória ainda não venceu", async () => {
    const sessao = new SessaoFalsa();
    const repositorio = new UsuarioRepositoryFalso();
    const noPrazo = new Date(Date.now() + 1000 * 60 * 60);
    repositorio.usuario = usuarioComSenhaProvisoria(
      "11111111-1111-1111-1111-111111111111",
      noPrazo,
    );

    const resultado = await new Login(sessao, repositorio).execute({
      email: "admin@rigonicontabil.local",
      senha: "admin123",
    });

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.value.precisaTrocarSenha).toBe(true);
  });

  // #58: o ban no Auth já barra o login; isto cobre o caso do ban ter falhado.
  it("bloqueia e encerra a sessão quando o usuário está desativado", async () => {
    const sessao = new SessaoFalsa();
    const repositorio = new UsuarioRepositoryFalso();
    const resultadoBuilder = Usuario.builder()
      .comId("11111111-1111-1111-1111-111111111111")
      .comNome("Jéssica")
      .comEmail("jessica@rigonicontabil.local")
      .comPapel("funcionario")
      .comSetor("simples_nacional")
      .comSenhaTrocadaEm(new Date().toISOString())
      .comDesativadoEm(new Date().toISOString())
      .build();
    if (!resultadoBuilder.ok) throw new Error("setup inválido");
    repositorio.usuario = resultadoBuilder.value;

    const resultado = await new Login(sessao, repositorio).execute({
      email: "jessica@rigonicontabil.local",
      senha: "qualquer",
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error.message).toBe("Conta desativada.");
    expect(sessao.encerrada).toBe(true);
  });
});
