import type {
  AuditoriaPort,
  RegistrarAcaoAuditoria,
} from "@/modules/usuarios/application/ports/out/auditoria.provider";
import type { AuthAdminPort } from "@/modules/usuarios/application/ports/out/auth-admin.provider";
import type { SessaoPort } from "@/modules/usuarios/application/ports/out/sessao.provider";
import type { UsuarioRepository } from "@/modules/usuarios/application/ports/out/usuario.repository";
import { Usuario, type UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

import { CriarUsuario } from "./criar-usuario.use-case";

function usuarioFalso(id: string, papel: string): Usuario {
  const resultado = Usuario.builder()
    .comId(id)
    .comNome("Alguém")
    .comEmail("alguem@rigonicontabil.local")
    .comPapel(papel)
    .comSetor("administrativo")
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
}

class UsuarioRepositoryFalso implements UsuarioRepository {
  ator: Usuario | null = usuarioFalso("admin-1", "admin");
  criado: Usuario | null = null;
  erroAoCriar = false;

  async buscarPorId(id: UsuarioId): Promise<Usuario | null> {
    return id === "admin-1" ? this.ator : null;
  }
  async criar(usuario: Usuario): Promise<Result<void, AppError>> {
    if (this.erroAoCriar) return err(new ValidationError("falha ao salvar"));
    this.criado = usuario;
    return ok(undefined);
  }
}

class AuthAdminFalso implements AuthAdminPort {
  idGerado = "novo-usuario-1";
  senhaGerada = "AAAAAAAAAAAA";
  erro: AppError | null = null;
  async criarConta(): Promise<Result<{ id: string; senhaProvisoria: string }, AppError>> {
    return this.erro
      ? err(this.erro)
      : ok({ id: this.idGerado, senhaProvisoria: this.senhaGerada });
  }
}

class AuditoriaFalsa implements AuditoriaPort {
  registros: RegistrarAcaoAuditoria[] = [];
  async registrar(input: RegistrarAcaoAuditoria): Promise<void> {
    this.registros.push(input);
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

    const resultado = await new CriarUsuario(sessao, usuarios, authAdmin, auditoria).execute(
      INPUT_VALIDO,
    );

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

  it("nega quando quem chama não é Admin", async () => {
    const sessao = new SessaoFalsa();
    const usuarios = new UsuarioRepositoryFalso();
    usuarios.ator = usuarioFalso("admin-1", "funcionario");
    const authAdmin = new AuthAdminFalso();
    const auditoria = new AuditoriaFalsa();

    const resultado = await new CriarUsuario(sessao, usuarios, authAdmin, auditoria).execute(
      INPUT_VALIDO,
    );

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toBeInstanceOf(ForbiddenError);
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
    ).execute(INPUT_VALIDO);

    expect(resultado.ok).toBe(false);
  });

  it("devolve erro e registra falha na auditoria quando o e-mail já existe", async () => {
    const sessao = new SessaoFalsa();
    const usuarios = new UsuarioRepositoryFalso();
    const authAdmin = new AuthAdminFalso();
    authAdmin.erro = new ValidationError("E-mail já cadastrado.", { email: ["já cadastrado"] });
    const auditoria = new AuditoriaFalsa();

    const resultado = await new CriarUsuario(sessao, usuarios, authAdmin, auditoria).execute(
      INPUT_VALIDO,
    );

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

    const resultado = await new CriarUsuario(sessao, usuarios, authAdmin, auditoria).execute(
      INPUT_VALIDO,
    );

    expect(resultado.ok).toBe(false);
    expect(auditoria.registros).toEqual([expect.objectContaining({ resultado: "falha" })]);
  });
});
