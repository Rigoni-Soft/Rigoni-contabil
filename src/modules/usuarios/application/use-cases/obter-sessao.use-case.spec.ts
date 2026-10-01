import type { SessaoPort } from "@/modules/usuarios/application/ports/out/sessao.provider";
import type { UsuarioRepository } from "@/modules/usuarios/application/ports/out/usuario.repository";
import { Usuario, type UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok, type Result } from "@/shared/kernel/result";

import { ObterSessao } from "./obter-sessao.use-case";

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
}

class UsuarioRepositoryFalso implements UsuarioRepository {
  usuario: Usuario | null = null;
  erroTecnico: AppError | null = null;
  async buscarPorId(): Promise<Result<Usuario | null, AppError>> {
    return this.erroTecnico ? err(this.erroTecnico) : ok(this.usuario);
  }
  async criar(): Promise<Result<void, AppError>> {
    return ok(undefined);
  }
}

function usuarioFalso(): Usuario {
  const resultado = Usuario.builder()
    .comId("11111111-1111-1111-1111-111111111111")
    .comNome("Jéssica")
    .comEmail("jessica@rigonicontabil.local")
    .comPapel("funcionario")
    .comSetor("simples_nacional")
    .build();
  if (!resultado.ok) throw new Error("setup inválido");
  return resultado.value;
}

describe("ObterSessao", () => {
  it("devolve null quando não há usuário logado", async () => {
    const resultado = await new ObterSessao(
      new SessaoFalsa(),
      new UsuarioRepositoryFalso(),
    ).execute();

    expect(resultado).toBeNull();
  });

  it("devolve o UsuarioDto quando há sessão e perfil", async () => {
    const sessao = new SessaoFalsa();
    sessao.id = "11111111-1111-1111-1111-111111111111" as UsuarioId;
    const repositorio = new UsuarioRepositoryFalso();
    repositorio.usuario = usuarioFalso();

    const resultado = await new ObterSessao(sessao, repositorio).execute();

    expect(resultado?.setor).toBe("simples_nacional");
  });

  it("devolve null (sem lançar) quando buscarPorId falha por erro técnico (devolutiva #55, ponto 02)", async () => {
    const sessao = new SessaoFalsa();
    sessao.id = "11111111-1111-1111-1111-111111111111" as UsuarioId;
    const repositorio = new UsuarioRepositoryFalso();
    repositorio.erroTecnico = new ForbiddenError("Falha ao buscar perfil: conexão recusada");

    const resultado = await new ObterSessao(sessao, repositorio).execute();

    expect(resultado).toBeNull();
  });
});
