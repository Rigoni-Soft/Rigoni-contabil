import type {
  AuditoriaPort,
  RegistrarAcaoAuditoria,
} from "@/modules/usuarios/application/ports/out/auditoria.provider";
import type { FinalizarTrocaSenhaPort } from "@/modules/usuarios/application/ports/out/finalizar-troca-senha.provider";
import type { SessaoPort } from "@/modules/usuarios/application/ports/out/sessao.provider";
import type { UsuarioRepository } from "@/modules/usuarios/application/ports/out/usuario.repository";
import { Usuario, type UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import type { AppError } from "@/shared/errors/app.error";
import { EstadoInconsistenteError } from "@/shared/errors/estado-inconsistente.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok, type Result } from "@/shared/kernel/result";

import { TrocarSenha } from "./trocar-senha.use-case";

function usuarioFalso(id: string, senhaTrocadaEm: string | null): Usuario {
  const resultado = Usuario.builder()
    .comId(id)
    .comNome("Jéssica Souza")
    .comEmail("jessica@rigonicontabil.local")
    .comPapel("funcionario")
    .comSetor("simples_nacional")
    .comSenhaTrocadaEm(senhaTrocadaEm)
    .comSenhaProvisoriaExpiraEm(new Date(Date.now() + 1000 * 60 * 60).toISOString())
    .build();
  if (!resultado.ok) throw new Error("setup inválido");
  return resultado.value;
}

class SessaoFalsa implements SessaoPort {
  id: UsuarioId | null = "11111111-1111-1111-1111-111111111111" as UsuarioId;
  erroAoTrocar: AppError | null = null;
  senhaTrocadaPara: string | null = null;

  async autenticar(): Promise<Result<void, AppError>> {
    return ok(undefined);
  }
  async encerrar(): Promise<Result<void, AppError>> {
    return ok(undefined);
  }
  async usuarioAtualId(): Promise<UsuarioId | null> {
    return this.id;
  }
  async trocarSenha(novaSenha: string): Promise<Result<void, AppError>> {
    if (this.erroAoTrocar) return err(this.erroAoTrocar);
    this.senhaTrocadaPara = novaSenha;
    return ok(undefined);
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

class FinalizarTrocaSenhaFalsa implements FinalizarTrocaSenhaPort {
  marcada = false;
  erro: AppError | null = null;

  async marcar(): Promise<Result<void, AppError>> {
    if (this.erro) return err(this.erro);
    this.marcada = true;
    return ok(undefined);
  }
}

class AuditoriaFalsa implements AuditoriaPort {
  registros: RegistrarAcaoAuditoria[] = [];
  erro: AppError | null = null;
  async registrar(input: RegistrarAcaoAuditoria): Promise<Result<void, AppError>> {
    if (this.erro) return err(this.erro);
    this.registros.push(input);
    return ok(undefined);
  }
}

describe("TrocarSenha", () => {
  it("troca a senha, marca no perfil e registra 'primeiro_acesso' na auditoria quando ainda não tinha trocado", async () => {
    const sessao = new SessaoFalsa();
    const usuarios = new UsuarioRepositoryFalso();
    usuarios.usuario = usuarioFalso("11111111-1111-1111-1111-111111111111", null);
    const finalizar = new FinalizarTrocaSenhaFalsa();
    const auditoria = new AuditoriaFalsa();

    const resultado = await new TrocarSenha(sessao, usuarios, finalizar, auditoria).execute({
      novaSenha: "nova-senha-123",
    });

    expect(resultado.ok).toBe(true);
    expect(sessao.senhaTrocadaPara).toBe("nova-senha-123");
    expect(finalizar.marcada).toBe(true);
    expect(auditoria.registros).toEqual([
      expect.objectContaining({ acao: "usuario.trocar_senha_primeiro_acesso" }),
    ]);
  });

  it("registra 'trocar_senha' (sem 'primeiro_acesso') quando é uma troca voluntária posterior", async () => {
    const sessao = new SessaoFalsa();
    const usuarios = new UsuarioRepositoryFalso();
    usuarios.usuario = usuarioFalso(
      "11111111-1111-1111-1111-111111111111",
      new Date().toISOString(),
    );
    const finalizar = new FinalizarTrocaSenhaFalsa();
    const auditoria = new AuditoriaFalsa();

    await new TrocarSenha(sessao, usuarios, finalizar, auditoria).execute({
      novaSenha: "outra-senha-456",
    });

    expect(auditoria.registros).toEqual([
      expect.objectContaining({ acao: "usuario.trocar_senha" }),
    ]);
  });

  it("nega sem sessão", async () => {
    const sessao = new SessaoFalsa();
    sessao.id = null;
    const usuarios = new UsuarioRepositoryFalso();
    const finalizar = new FinalizarTrocaSenhaFalsa();
    const auditoria = new AuditoriaFalsa();

    const resultado = await new TrocarSenha(sessao, usuarios, finalizar, auditoria).execute({
      novaSenha: "nova-senha-123",
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toBeInstanceOf(ForbiddenError);
  });

  it("propaga o erro tecnico (nao 'sem perfil cadastrado') quando buscarPorId falha (devolutiva #55, ponto 02)", async () => {
    const sessao = new SessaoFalsa();
    const usuarios = new UsuarioRepositoryFalso();
    usuarios.erroTecnico = new ForbiddenError("Falha ao buscar perfil: indisponível");
    const finalizar = new FinalizarTrocaSenhaFalsa();
    const auditoria = new AuditoriaFalsa();

    const resultado = await new TrocarSenha(sessao, usuarios, finalizar, auditoria).execute({
      novaSenha: "nova-senha-123",
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error.message).not.toMatch(/sem perfil cadastrado/);
  });

  it("propaga a falha e não finaliza quando o gateway de sessão falha", async () => {
    const sessao = new SessaoFalsa();
    sessao.erroAoTrocar = new ForbiddenError("falha ao trocar");
    const usuarios = new UsuarioRepositoryFalso();
    usuarios.usuario = usuarioFalso("11111111-1111-1111-1111-111111111111", null);
    const finalizar = new FinalizarTrocaSenhaFalsa();
    const auditoria = new AuditoriaFalsa();

    const resultado = await new TrocarSenha(sessao, usuarios, finalizar, auditoria).execute({
      novaSenha: "nova-senha-123",
    });

    expect(resultado.ok).toBe(false);
    expect(finalizar.marcada).toBe(false);
    expect(auditoria.registros).toEqual([]);
  });

  // Devolutiva técnica PR #62, pontos 4 e 5: a senha já mudou no Auth nesse
  // ponto (ADR 0002, não existe "desfazer") — a falha não pode virar sucesso
  // silencioso nem um erro indistinguível de "nada aconteceu".
  it("devolve EstadoInconsistenteError (não sucesso) quando a finalização falha depois da senha já trocada no Auth", async () => {
    const sessao = new SessaoFalsa();
    const usuarios = new UsuarioRepositoryFalso();
    usuarios.usuario = usuarioFalso("11111111-1111-1111-1111-111111111111", null);
    const finalizar = new FinalizarTrocaSenhaFalsa();
    finalizar.erro = new ForbiddenError("Falha ao marcar troca de senha: indisponível");
    const auditoria = new AuditoriaFalsa();

    const resultado = await new TrocarSenha(sessao, usuarios, finalizar, auditoria).execute({
      novaSenha: "nova-senha-123",
    });

    expect(sessao.senhaTrocadaPara).toBe("nova-senha-123");
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toBeInstanceOf(EstadoInconsistenteError);
    expect(auditoria.registros).toEqual([]);
  });

  it("devolve EstadoInconsistenteError (não sucesso) quando a auditoria falha depois da senha já trocada e marcada", async () => {
    const sessao = new SessaoFalsa();
    const usuarios = new UsuarioRepositoryFalso();
    usuarios.usuario = usuarioFalso("11111111-1111-1111-1111-111111111111", null);
    const finalizar = new FinalizarTrocaSenhaFalsa();
    const auditoria = new AuditoriaFalsa();
    auditoria.erro = new ForbiddenError("Falha ao registrar auditoria: indisponível");

    const resultado = await new TrocarSenha(sessao, usuarios, finalizar, auditoria).execute({
      novaSenha: "nova-senha-123",
    });

    expect(sessao.senhaTrocadaPara).toBe("nova-senha-123");
    expect(finalizar.marcada).toBe(true);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toBeInstanceOf(EstadoInconsistenteError);
  });
});
