import type { RegistroDeErrosPort } from "@/modules/usuarios/application/ports/out/registro-de-erros.provider";
import type { SessaoPort } from "@/modules/usuarios/application/ports/out/sessao.provider";
import type { UsuarioRepository } from "@/modules/usuarios/application/ports/out/usuario.repository";
import { Usuario, type UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok, type Result } from "@/shared/kernel/result";

import { ObterSessao } from "./obter-sessao.use-case";

const erros: RegistroDeErrosPort = { registrar: jest.fn() };

class SessaoFalsa implements SessaoPort {
  id: UsuarioId | null = null;
  async autenticar(): Promise<Result<void, AppError>> {
    return ok(undefined);
  }
  async encerrar(): Promise<Result<void, AppError>> {
    return ok(undefined);
  }
  async usuarioAtualId(): Promise<UsuarioId | null> {
    return this.id;
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
  async listarComBloqueioPendente(): Promise<Result<Usuario[], AppError>> {
    return ok([]);
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
}

function usuarioFalso(senhaProvisoriaExpiraEm = new Date(Date.now() + 1000 * 60 * 60)): Usuario {
  const resultado = Usuario.builder()
    .comId("11111111-1111-1111-1111-111111111111")
    .comNome("Jéssica")
    .comEmail("jessica@rigonicontabil.local")
    .comPapel("funcionario")
    .comSetor("simples_nacional")
    .comSenhaTrocadaEm(null)
    .comSenhaProvisoriaExpiraEm(senhaProvisoriaExpiraEm.toISOString())
    .build();
  if (!resultado.ok) throw new Error("setup inválido");
  return resultado.value;
}

describe("ObterSessao", () => {
  it("devolve null quando não há usuário logado", async () => {
    const resultado = await new ObterSessao(
      new SessaoFalsa(),
      new UsuarioRepositoryFalso(),
      erros,
    ).execute();

    expect(resultado).toBeNull();
  });

  it("devolve o UsuarioDto quando há sessão e perfil", async () => {
    const sessao = new SessaoFalsa();
    sessao.id = "11111111-1111-1111-1111-111111111111" as UsuarioId;
    const repositorio = new UsuarioRepositoryFalso();
    repositorio.usuario = usuarioFalso();

    const resultado = await new ObterSessao(sessao, repositorio, erros).execute();

    expect(resultado?.setor).toBe("simples_nacional");
  });

  it("devolve null (sem lançar) quando buscarPorId falha por erro técnico", async () => {
    const sessao = new SessaoFalsa();
    sessao.id = "11111111-1111-1111-1111-111111111111" as UsuarioId;
    const repositorio = new UsuarioRepositoryFalso();
    repositorio.erroTecnico = new ForbiddenError("Falha ao buscar perfil: conexão recusada");

    const resultado = await new ObterSessao(sessao, repositorio, erros).execute();

    expect(resultado).toBeNull();
  });

  // Login só checava o vencimento ao entrar; uma sessão aberta antes dele seguia
  // válida depois. Toda página passa por carregarSessao() → aqui.
  it("devolve null quando a senha provisória da sessão já venceu, mesmo com sessão ativa", async () => {
    const sessao = new SessaoFalsa();
    sessao.id = "11111111-1111-1111-1111-111111111111" as UsuarioId;
    const repositorio = new UsuarioRepositoryFalso();
    repositorio.usuario = usuarioFalso(new Date(Date.now() - 1000 * 60 * 60));

    const resultado = await new ObterSessao(sessao, repositorio, erros).execute();

    expect(resultado).toBeNull();
  });

  // Soft delete — sessão aberta antes da desativação para de valer na próxima página.
  it("devolve null quando o usuário foi desativado, mesmo com sessão ativa", async () => {
    const sessao = new SessaoFalsa();
    sessao.id = "11111111-1111-1111-1111-111111111111" as UsuarioId;
    const repositorio = new UsuarioRepositoryFalso();
    const resultado = Usuario.builder()
      .comId("11111111-1111-1111-1111-111111111111")
      .comNome("Jéssica")
      .comEmail("jessica@rigonicontabil.local")
      .comPapel("funcionario")
      .comSetor("simples_nacional")
      .comSenhaTrocadaEm(new Date().toISOString())
      .comDesativadoEm(new Date().toISOString())
      .build();
    if (!resultado.ok) throw new Error("setup inválido");
    repositorio.usuario = resultado.value;

    expect(await new ObterSessao(sessao, repositorio, erros).execute()).toBeNull();
  });
});
