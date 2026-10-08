import type {
  AuditoriaPort,
  RegistrarAcaoAuditoria,
} from "@/modules/usuarios/application/ports/out/auditoria.provider";
import type { AuthAdminPort } from "@/modules/usuarios/application/ports/out/auth-admin.provider";
import type { SessaoPort } from "@/modules/usuarios/application/ports/out/sessao.provider";
import type { UsuarioRepository } from "@/modules/usuarios/application/ports/out/usuario.repository";
import { Usuario, type UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import { AutorizacaoService } from "@/modules/usuarios/domain/services/autorizacao.service";
import type { AppError } from "@/shared/errors/app.error";
import { EstadoInconsistenteError } from "@/shared/errors/estado-inconsistente.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

import { CriarUsuario } from "./criar-usuario.use-case";

function usuarioFalso(id: string, papel: string, setor = "administrativo"): Usuario {
  const resultado = Usuario.builder()
    .comId(id)
    .comNome("Alguém")
    .comEmail("alguem@rigonicontabil.local")
    .comPapel(papel)
    .comSetor(setor)
    .build();
  if (!resultado.ok) throw new Error("setup inválido");
  return resultado.value;
}

class SessaoFalsa implements SessaoPort {
  atorId: UsuarioId | null = "admin-1" as UsuarioId;
  async autenticar(): Promise<Result<void, AppError>> {
    return ok(undefined);
  }
  async encerrar(): Promise<Result<void, AppError>> {
    return ok(undefined);
  }
  async usuarioAtualId(): Promise<UsuarioId | null> {
    return this.atorId;
  }
  async trocarSenha(): Promise<Result<void, AppError>> {
    return ok(undefined);
  }
}

class UsuarioRepositoryFalso implements UsuarioRepository {
  ator: Usuario | null = usuarioFalso("admin-1", "admin");
  criado: Usuario | null = null;
  erroAoCriar = false;
  erroTecnicoAoBuscarAtor: AppError | null = null;

  async buscarPorId(id: UsuarioId): Promise<Result<Usuario | null, AppError>> {
    if (this.erroTecnicoAoBuscarAtor) return err(this.erroTecnicoAoBuscarAtor);
    return ok(id === "admin-1" ? this.ator : null);
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
  async criar(usuario: Usuario): Promise<Result<void, AppError>> {
    if (this.erroAoCriar) return err(new ValidationError("falha ao salvar"));
    this.criado = usuario;
    return ok(undefined);
  }
  async marcarSenhaTrocada(): Promise<Result<void, AppError>> {
    return ok(undefined);
  }
}

class AuthAdminFalso implements AuthAdminPort {
  idGerado = "novo-usuario-1";
  senhaGerada = "AAAAAAAAAAAA";
  erro: AppError | null = null;
  erroAoRemover: AppError | null = null;
  contasRemovidas: string[] = [];
  async criarConta(): Promise<Result<{ id: string; senhaProvisoria: string }, AppError>> {
    return this.erro
      ? err(this.erro)
      : ok({ id: this.idGerado, senhaProvisoria: this.senhaGerada });
  }
  async banirConta(): Promise<Result<void, AppError>> {
    return ok(undefined);
  }
  async removerConta(id: string): Promise<Result<void, AppError>> {
    this.contasRemovidas.push(id);
    return this.erroAoRemover ? err(this.erroAoRemover) : ok(undefined);
  }
}

class AuditoriaFalsa implements AuditoriaPort {
  registros: RegistrarAcaoAuditoria[] = [];
  erroNoSucesso: AppError | null = null;
  async registrar(input: RegistrarAcaoAuditoria): Promise<Result<void, AppError>> {
    this.registros.push(input);
    if (input.resultado === "sucesso" && this.erroNoSucesso) return err(this.erroNoSucesso);
    return ok(undefined);
  }
}

const INPUT_VALIDO = {
  nome: "Jéssica Souza",
  email: "jessica@rigonicontabil.local",
  papel: "funcionario" as const,
  setor: "simples_nacional",
};

describe("CriarUsuario", () => {
  it("Admin cria a conta: gera senha provisória, cria no Auth, salva o perfil e registra sucesso na auditoria", async () => {
    const sessao = new SessaoFalsa();
    const usuarios = new UsuarioRepositoryFalso();
    const authAdmin = new AuthAdminFalso();
    const auditoria = new AuditoriaFalsa();

    const resultado = await new CriarUsuario(
      sessao,
      usuarios,
      authAdmin,
      auditoria,
      new AutorizacaoService(),
    ).execute(INPUT_VALIDO);

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.value.senhaProvisoria).toHaveLength(12);
      expect(resultado.value.usuario.id).toBe("novo-usuario-1");
      expect(resultado.value.usuario.papel).toBe("funcionario");
    }
    expect(usuarios.criado?.id).toBe("novo-usuario-1");
    expect(auditoria.registros).toEqual([
      expect.objectContaining({
        ator: "admin-1",
        setor: "simples_nacional",
        acao: "usuario.criar",
        alvo: "jessica@rigonicontabil.local",
        resultado: "sucesso",
      }),
    ]);
  });

  it("Líder de setor cria Funcionário do próprio Setor", async () => {
    const sessao = new SessaoFalsa();
    const usuarios = new UsuarioRepositoryFalso();
    usuarios.ator = usuarioFalso("lider-1", "lider_setor", "simples_nacional");
    const authAdmin = new AuthAdminFalso();
    const auditoria = new AuditoriaFalsa();

    const resultado = await new CriarUsuario(
      sessao,
      usuarios,
      authAdmin,
      auditoria,
      new AutorizacaoService(),
    ).execute(INPUT_VALIDO);

    expect(resultado.ok).toBe(true);
    expect(usuarios.criado?.id).toBe("novo-usuario-1");
  });

  it("nega quando Líder tenta cadastrar em outro Setor", async () => {
    const sessao = new SessaoFalsa();
    const usuarios = new UsuarioRepositoryFalso();
    usuarios.ator = usuarioFalso("lider-1", "lider_setor", "administrativo");
    const authAdmin = new AuthAdminFalso();
    const auditoria = new AuditoriaFalsa();

    const resultado = await new CriarUsuario(
      sessao,
      usuarios,
      authAdmin,
      auditoria,
      new AutorizacaoService(),
    ).execute(INPUT_VALIDO);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toBeInstanceOf(ForbiddenError);
    expect(usuarios.criado).toBeNull();
  });

  it("nega quando Líder tenta cadastrar outro Líder", async () => {
    const sessao = new SessaoFalsa();
    const usuarios = new UsuarioRepositoryFalso();
    usuarios.ator = usuarioFalso("lider-1", "lider_setor", "simples_nacional");
    const authAdmin = new AuthAdminFalso();
    const auditoria = new AuditoriaFalsa();

    const resultado = await new CriarUsuario(
      sessao,
      usuarios,
      authAdmin,
      auditoria,
      new AutorizacaoService(),
    ).execute({
      ...INPUT_VALIDO,
      papel: "lider_setor",
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toBeInstanceOf(ForbiddenError);
    expect(usuarios.criado).toBeNull();
  });

  it("nega quando quem chama não é Admin", async () => {
    const sessao = new SessaoFalsa();
    const usuarios = new UsuarioRepositoryFalso();
    usuarios.ator = usuarioFalso("admin-1", "funcionario");
    const authAdmin = new AuthAdminFalso();
    const auditoria = new AuditoriaFalsa();

    const resultado = await new CriarUsuario(
      sessao,
      usuarios,
      authAdmin,
      auditoria,
      new AutorizacaoService(),
    ).execute(INPUT_VALIDO);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toBeInstanceOf(ForbiddenError);
    expect(usuarios.criado).toBeNull();
  });

  it("nega quando o Líder foi desativado mas a sessão ainda vale (#58)", async () => {
    const usuarios = new UsuarioRepositoryFalso();
    const lider = Usuario.builder()
      .comId("admin-1")
      .comNome("Alguém")
      .comEmail("alguem@rigonicontabil.local")
      .comPapel("lider_setor")
      .comSetor("simples_nacional")
      .comDesativadoEm("2026-10-01T00:00:00Z")
      .build();
    if (!lider.ok) throw new Error("setup inválido");
    usuarios.ator = lider.value;

    const resultado = await new CriarUsuario(
      new SessaoFalsa(),
      usuarios,
      new AuthAdminFalso(),
      new AuditoriaFalsa(),
      new AutorizacaoService(),
    ).execute(INPUT_VALIDO);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toBeInstanceOf(ForbiddenError);
    expect(usuarios.criado).toBeNull();
  });

  it("propaga o erro tecnico (nao 'sem permissao') quando buscarPorId do ator falha (devolutiva #55, ponto 02)", async () => {
    const sessao = new SessaoFalsa();
    const usuarios = new UsuarioRepositoryFalso();
    usuarios.erroTecnicoAoBuscarAtor = new ForbiddenError("Falha ao buscar perfil: indisponível");
    const authAdmin = new AuthAdminFalso();
    const auditoria = new AuditoriaFalsa();

    const resultado = await new CriarUsuario(
      sessao,
      usuarios,
      authAdmin,
      auditoria,
      new AutorizacaoService(),
    ).execute(INPUT_VALIDO);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error.message).not.toMatch(/Admin cadastra/);
    expect(usuarios.criado).toBeNull();
  });

  it("nega sem sessão", async () => {
    const sessao = new SessaoFalsa();
    sessao.atorId = null;
    const resultado = await new CriarUsuario(
      sessao,
      new UsuarioRepositoryFalso(),
      new AuthAdminFalso(),
      new AuditoriaFalsa(),
      new AutorizacaoService(),
    ).execute(INPUT_VALIDO);

    expect(resultado.ok).toBe(false);
  });

  it("devolve erro e registra falha na auditoria quando o e-mail já existe", async () => {
    const sessao = new SessaoFalsa();
    const usuarios = new UsuarioRepositoryFalso();
    const authAdmin = new AuthAdminFalso();
    authAdmin.erro = new ValidationError("E-mail já cadastrado.", { email: ["já cadastrado"] });
    const auditoria = new AuditoriaFalsa();

    const resultado = await new CriarUsuario(
      sessao,
      usuarios,
      authAdmin,
      auditoria,
      new AutorizacaoService(),
    ).execute(INPUT_VALIDO);

    expect(resultado.ok).toBe(false);
    expect(usuarios.criado).toBeNull();
    expect(auditoria.registros).toEqual([expect.objectContaining({ resultado: "falha" })]);
  });

  it("devolve erro e registra falha na auditoria quando salvar o perfil falha", async () => {
    const sessao = new SessaoFalsa();
    const usuarios = new UsuarioRepositoryFalso();
    usuarios.erroAoCriar = true;
    const authAdmin = new AuthAdminFalso();
    const auditoria = new AuditoriaFalsa();

    const resultado = await new CriarUsuario(
      sessao,
      usuarios,
      authAdmin,
      auditoria,
      new AutorizacaoService(),
    ).execute(INPUT_VALIDO);

    expect(resultado.ok).toBe(false);
    expect(auditoria.registros).toEqual([expect.objectContaining({ resultado: "falha" })]);
  });

  // Devolutiva técnica PR #61, ponto 1: nenhum destes 3 casos pode deixar a
  // conta Auth (id "novo-usuario-1", gerada por AuthAdminFalso) sem compensação.
  it("compensa (remove a conta Auth) quando o INSERT em perfis falha depois da conta já criada", async () => {
    const sessao = new SessaoFalsa();
    const usuarios = new UsuarioRepositoryFalso();
    usuarios.erroAoCriar = true;
    const authAdmin = new AuthAdminFalso();
    const auditoria = new AuditoriaFalsa();

    await new CriarUsuario(
      sessao,
      usuarios,
      authAdmin,
      auditoria,
      new AutorizacaoService(),
    ).execute(INPUT_VALIDO);

    expect(authAdmin.contasRemovidas).toEqual(["novo-usuario-1"]);
  });

  it("compensa quando a auditoria de sucesso falha (auditoria deixou de ser best-effort no caminho feliz)", async () => {
    const sessao = new SessaoFalsa();
    const usuarios = new UsuarioRepositoryFalso();
    const authAdmin = new AuthAdminFalso();
    const auditoria = new AuditoriaFalsa();
    auditoria.erroNoSucesso = new ValidationError("falha ao gravar auditoria");

    const resultado = await new CriarUsuario(
      sessao,
      usuarios,
      authAdmin,
      auditoria,
      new AutorizacaoService(),
    ).execute(INPUT_VALIDO);

    expect(resultado.ok).toBe(false);
    expect(authAdmin.contasRemovidas).toEqual(["novo-usuario-1"]);
    // O perfil já tinha sido salvo antes da auditoria falhar — a compensação real
    // (delete no Auth, testada no gateway/integração) cascateia pro perfil via FK;
    // aqui, no unit test com fakes, só garantimos que a compensação foi acionada.
  });

  // Ajuste residual da devolutiva PR #61: falha da própria compensação deixa de
  // ser mascarada como o erro original — vira erro específico + registro de
  // auditoria próprio, distinguível de "rollback funcionou".
  it("distingue falha da própria compensação: erro específico, registro de auditoria próprio e log sem senha", async () => {
    const sessao = new SessaoFalsa();
    const usuarios = new UsuarioRepositoryFalso();
    usuarios.erroAoCriar = true;
    const authAdmin = new AuthAdminFalso();
    authAdmin.erroAoRemover = new ValidationError("falha ao remover conta");
    const auditoria = new AuditoriaFalsa();
    const erroConsole = jest.spyOn(console, "error").mockImplementation(() => {});

    const resultado = await new CriarUsuario(
      sessao,
      usuarios,
      authAdmin,
      auditoria,
      new AutorizacaoService(),
    ).execute(INPUT_VALIDO);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error).toBeInstanceOf(EstadoInconsistenteError);
      expect(resultado.error.code).toBe("INCONSISTENT_STATE");
    }
    expect(auditoria.registros).toEqual([
      expect.objectContaining({ resultado: "falha_compensacao" }),
    ]);
    const [, ...mensagensLogadas] = erroConsole.mock.calls[0] as unknown as string[];
    expect(mensagensLogadas.join(" ")).not.toContain(authAdmin.senhaGerada);
    erroConsole.mockRestore();
  });

  it("quando a compensação tem sucesso, devolve o erro original (não o de estado inconsistente) e audita 'falha'", async () => {
    const sessao = new SessaoFalsa();
    const usuarios = new UsuarioRepositoryFalso();
    usuarios.erroAoCriar = true;
    const authAdmin = new AuthAdminFalso();
    const auditoria = new AuditoriaFalsa();

    const resultado = await new CriarUsuario(
      sessao,
      usuarios,
      authAdmin,
      auditoria,
      new AutorizacaoService(),
    ).execute(INPUT_VALIDO);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error.message).toBe("falha ao salvar");
    expect(auditoria.registros).toEqual([expect.objectContaining({ resultado: "falha" })]);
  });
});
