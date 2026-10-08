import type { SessaoPort } from "@/modules/usuarios/application/ports/out/sessao.provider";
import type { UsuarioRepository } from "@/modules/usuarios/application/ports/out/usuario.repository";
import { Usuario, type UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import { AutorizacaoService } from "@/modules/usuarios/domain/services/autorizacao.service";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok, type Result } from "@/shared/kernel/result";

import { ListarSetores } from "./listar-setores.use-case";

function usuarioFalso(papel: string, setor: string): Usuario {
  const resultado = Usuario.builder()
    .comId("11111111-1111-1111-1111-111111111111")
    .comNome("Alguém")
    .comEmail("alguem@rigonicontabil.local")
    .comPapel(papel)
    .comSetor(setor)
    .build();
  if (!resultado.ok) throw new Error("setup inválido");
  return resultado.value;
}

class SessaoFalsa implements SessaoPort {
  id: UsuarioId | null = "11111111-1111-1111-1111-111111111111" as UsuarioId;
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
  async marcarSenhaTrocada(): Promise<Result<void, AppError>> {
    return ok(undefined);
  }
}

describe("ListarSetores", () => {
  // #58: JWT de quem foi desativado vale até expirar; o perfil é a fonte da verdade.
  it("devolve lista vazia quando o usuário foi desativado, mesmo com sessão ativa", async () => {
    const sessao = new SessaoFalsa();
    const usuarios = new UsuarioRepositoryFalso();
    const resultado = Usuario.builder()
      .comId("11111111-1111-1111-1111-111111111111")
      .comNome("Alguém")
      .comEmail("alguem@rigonicontabil.local")
      .comPapel("admin")
      .comSetor("administrativo")
      .comDesativadoEm(new Date().toISOString())
      .build();
    if (!resultado.ok) throw new Error("setup inválido");
    usuarios.usuario = resultado.value;

    const setores = await new ListarSetores(sessao, usuarios, new AutorizacaoService()).execute();

    expect(setores).toEqual([]);
  });

  it("Admin vê todos os setores do organograma, exceto Patriki e Expedição", async () => {
    const sessao = new SessaoFalsa();
    const usuarios = new UsuarioRepositoryFalso();
    usuarios.usuario = usuarioFalso("admin", "administrativo");

    const setores = await new ListarSetores(sessao, usuarios, new AutorizacaoService()).execute();
    const slugs = setores.map((s) => s.slug);

    expect(slugs).toContain("simples_nacional");
    expect(slugs).toContain("tributario");
    expect(slugs).toContain("administrativo");
    expect(slugs).not.toContain("patriki");
    expect(slugs).not.toContain("expedicao");
    expect(slugs.length).toBeGreaterThan(1);
  });

  it("Funcionário vê só o próprio setor", async () => {
    const sessao = new SessaoFalsa();
    const usuarios = new UsuarioRepositoryFalso();
    usuarios.usuario = usuarioFalso("funcionario", "simples_nacional");

    const setores = await new ListarSetores(sessao, usuarios, new AutorizacaoService()).execute();

    expect(setores).toEqual([{ slug: "simples_nacional" }]);
  });

  it("Líder de setor vê só o próprio setor", async () => {
    const sessao = new SessaoFalsa();
    const usuarios = new UsuarioRepositoryFalso();
    usuarios.usuario = usuarioFalso("lider_setor", "contabil");

    const setores = await new ListarSetores(sessao, usuarios, new AutorizacaoService()).execute();

    expect(setores).toEqual([{ slug: "contabil" }]);
  });

  it("devolve lista vazia sem sessão", async () => {
    const sessao = new SessaoFalsa();
    sessao.id = null;
    const usuarios = new UsuarioRepositoryFalso();

    const setores = await new ListarSetores(sessao, usuarios, new AutorizacaoService()).execute();

    expect(setores).toEqual([]);
  });

  it("devolve lista vazia (sem lançar) quando buscarPorId falha por erro técnico (devolutiva #55, ponto 02)", async () => {
    const sessao = new SessaoFalsa();
    const usuarios = new UsuarioRepositoryFalso();
    usuarios.erroTecnico = new ForbiddenError("Falha ao buscar perfil: conexão recusada");

    const setores = await new ListarSetores(sessao, usuarios, new AutorizacaoService()).execute();

    expect(setores).toEqual([]);
  });
});
