import type {
  AuditoriaPort,
  RegistrarAcaoAuditoria,
} from "@/modules/usuarios/application/ports/out/auditoria.provider";
import type { FinalizarTrocaSenhaPort } from "@/modules/usuarios/application/ports/out/finalizar-troca-senha.provider";
import type { SessaoPort } from "@/modules/usuarios/application/ports/out/sessao.provider";
import type { UsuarioRepository } from "@/modules/usuarios/application/ports/out/usuario.repository";
import { Usuario, type UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import { AppError } from "@/shared/errors/app.error";
import { EstadoInconsistenteError } from "@/shared/errors/estado-inconsistente.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

import { TrocarSenha } from "./trocar-senha.use-case";

const ID = "11111111-1111-1111-1111-111111111111";

// Mesmo code que SupabaseSessaoGateway devolve pro "same_password" do Auth
// (devolutiva técnica PR #62, ponto 1) — sem importar infra no teste da
// application (regra "so-main-importa-infra" do dependency-cruiser).
class SenhaJaDefinidaFalsa extends AppError {
  readonly code = "SENHA_JA_DEFINIDA";
}

function usuarioFalso(
  senhaTrocadaEm: string | null,
  senhaAuthAlteradaEm: string | null = null,
): Usuario {
  const resultado = Usuario.builder()
    .comId(ID)
    .comNome("Jéssica Souza")
    .comEmail("jessica@rigonicontabil.local")
    .comPapel("funcionario")
    .comSetor("simples_nacional")
    .comSenhaTrocadaEm(senhaTrocadaEm)
    .comSenhaAuthAlteradaEm(senhaAuthAlteradaEm)
    .comSenhaProvisoriaExpiraEm(new Date(Date.now() + 1000 * 60 * 60).toISOString())
    .build();
  if (!resultado.ok) throw new Error("setup inválido");
  return resultado.value;
}

class SessaoFalsa implements SessaoPort {
  id: UsuarioId | null = ID as UsuarioId;
  erroAoTrocar: AppError | null = null;
  senhaTrocadaPara: string | null = null;
  chamadasTrocar = 0;

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
    this.chamadasTrocar++;
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
  async listarAtivos(): Promise<Result<Usuario[], AppError>> {
    return ok([]);
  }
  async criar(): Promise<Result<void, AppError>> {
    return ok(undefined);
  }
}

// Simula a RPC real: finalizar() é atômica (perfil + 1 auditoria) e idempotente;
// `falhasRestantes` faz as N próximas chamadas falharem sem efeito algum.
class FinalizarTrocaSenhaFalsa implements FinalizarTrocaSenhaPort {
  provaGravada = false;
  marcada = false;
  falhasRestantes = 0;
  erroAoRegistrarProva: AppError | null = null;
  auditoriasGravadas: string[] = [];

  async registrarAuthAlterado(): Promise<Result<void, AppError>> {
    if (this.erroAoRegistrarProva) return err(this.erroAoRegistrarProva);
    this.provaGravada = true;
    return ok(undefined);
  }
  async finalizar(): Promise<Result<void, AppError>> {
    if (this.falhasRestantes > 0) {
      this.falhasRestantes--;
      return err(new ForbiddenError("Falha ao finalizar: indisponível"));
    }
    if (!this.marcada) {
      this.auditoriasGravadas.push("usuario.trocar_senha_primeiro_acesso");
      this.marcada = true;
    }
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

function montar() {
  const sessao = new SessaoFalsa();
  const usuarios = new UsuarioRepositoryFalso();
  const finalizar = new FinalizarTrocaSenhaFalsa();
  const auditoria = new AuditoriaFalsa();
  const useCase = new TrocarSenha(sessao, usuarios, finalizar, auditoria);
  return { sessao, usuarios, finalizar, auditoria, useCase };
}

describe("TrocarSenha", () => {
  // #58: JWT de quem foi desativado vale até expirar; o perfil é a fonte da verdade.
  it("nega usuário desativado com sessão ainda válida, sem tocar no Auth", async () => {
    const { usuarios, sessao, useCase } = montar();
    const desativado = Usuario.builder()
      .comId(ID)
      .comNome("Jéssica Souza")
      .comEmail("jessica@rigonicontabil.local")
      .comPapel("funcionario")
      .comSetor("simples_nacional")
      .comSenhaTrocadaEm(new Date().toISOString())
      .comDesativadoEm(new Date().toISOString())
      .build();
    if (!desativado.ok) throw new Error("setup inválido");
    usuarios.usuario = desativado.value;

    const resultado = await useCase.execute({ novaSenha: "nova-senha-123" });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toBeInstanceOf(ForbiddenError);
    expect(sessao.chamadasTrocar).toBe(0);
  });

  it("primeiro acesso: troca a senha e finaliza perfil + 1 auditoria 'primeiro_acesso'", async () => {
    const { sessao, usuarios, finalizar, auditoria, useCase } = montar();
    usuarios.usuario = usuarioFalso(null);

    const resultado = await useCase.execute({ novaSenha: "nova-senha-123" });

    expect(resultado.ok).toBe(true);
    expect(sessao.senhaTrocadaPara).toBe("nova-senha-123");
    expect(finalizar.provaGravada).toBe(true);
    expect(finalizar.marcada).toBe(true);
    expect(finalizar.auditoriasGravadas).toEqual(["usuario.trocar_senha_primeiro_acesso"]);
    expect(auditoria.registros).toEqual([]);
  });

  it("registra 'trocar_senha' (sem 'primeiro_acesso') quando é uma troca voluntária posterior", async () => {
    const { usuarios, auditoria, useCase } = montar();
    usuarios.usuario = usuarioFalso(new Date().toISOString());

    await useCase.execute({ novaSenha: "outra-senha-456" });

    expect(auditoria.registros).toEqual([
      expect.objectContaining({ acao: "usuario.trocar_senha" }),
    ]);
  });

  it("nega sem sessão", async () => {
    const { sessao, useCase } = montar();
    sessao.id = null;

    const resultado = await useCase.execute({ novaSenha: "nova-senha-123" });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toBeInstanceOf(ForbiddenError);
  });

  it("propaga o erro tecnico (nao 'sem perfil cadastrado') quando buscarPorId falha (devolutiva #55, ponto 02)", async () => {
    const { usuarios, useCase } = montar();
    usuarios.erroTecnico = new ForbiddenError("Falha ao buscar perfil: indisponível");

    const resultado = await useCase.execute({ novaSenha: "nova-senha-123" });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error.message).not.toMatch(/sem perfil cadastrado/);
  });

  it("propaga a falha, não grava a prova de Auth alterado e não finaliza quando o gateway de sessão falha", async () => {
    const { sessao, usuarios, finalizar, auditoria, useCase } = montar();
    sessao.erroAoTrocar = new ForbiddenError("falha ao trocar");
    usuarios.usuario = usuarioFalso(null);

    const resultado = await useCase.execute({ novaSenha: "nova-senha-123" });

    expect(resultado.ok).toBe(false);
    expect(finalizar.provaGravada).toBe(false);
    expect(finalizar.marcada).toBe(false);
    expect(auditoria.registros).toEqual([]);
  });

  it("ainda finaliza perfil + auditoria quando só a gravação da prova de Auth alterado falha", async () => {
    const { usuarios, finalizar, useCase } = montar();
    usuarios.usuario = usuarioFalso(null);
    finalizar.erroAoRegistrarProva = new ForbiddenError("indisponível");

    const resultado = await useCase.execute({ novaSenha: "nova-senha-123" });

    expect(resultado.ok).toBe(true);
    expect(finalizar.auditoriasGravadas).toHaveLength(1);
  });

  // Devolutiva técnica PR #62, pontos 4 e 5: a senha já mudou no Auth nesse
  // ponto (ADR 0002, não existe "desfazer") — a falha não pode virar sucesso
  // silencioso nem um erro indistinguível de "nada aconteceu".
  it("devolve EstadoInconsistenteError (não sucesso) quando a finalização falha depois da senha já trocada", async () => {
    const { sessao, usuarios, finalizar, useCase } = montar();
    usuarios.usuario = usuarioFalso(null);
    finalizar.falhasRestantes = 1;

    const resultado = await useCase.execute({ novaSenha: "nova-senha-123" });

    expect(sessao.senhaTrocadaPara).toBe("nova-senha-123");
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toBeInstanceOf(EstadoInconsistenteError);
    expect(finalizar.auditoriasGravadas).toEqual([]);
  });

  // Critério de aceite da devolutiva PR #62 (retry): Auth alterado com sucesso →
  // finalização falha → retry → updateUser NÃO é chamado de novo → perfil +
  // auditoria concluídos exatamente uma vez.
  it("retry após falha na finalização não chama updateUser de novo e grava exatamente 1 auditoria", async () => {
    const { sessao, usuarios, finalizar, auditoria, useCase } = montar();
    usuarios.usuario = usuarioFalso(null);
    finalizar.falhasRestantes = 1;

    const primeira = await useCase.execute({ novaSenha: "nova-senha-123" });
    expect(primeira.ok).toBe(false);
    expect(sessao.chamadasTrocar).toBe(1);
    expect(finalizar.provaGravada).toBe(true);

    // Perfil relido no retry: ainda em primeiro acesso, mas com a prova gravada.
    usuarios.usuario = usuarioFalso(null, new Date().toISOString());

    const retry = await useCase.execute({ novaSenha: "nova-senha-123" });

    expect(retry.ok).toBe(true);
    expect(sessao.chamadasTrocar).toBe(1);
    expect(finalizar.marcada).toBe(true);
    expect(finalizar.auditoriasGravadas).toEqual(["usuario.trocar_senha_primeiro_acesso"]);
    expect(auditoria.registros).toEqual([]);
  });

  it("retry repetido depois de concluída não chama o Auth nem duplica a auditoria", async () => {
    const { sessao, usuarios, finalizar, useCase } = montar();
    usuarios.usuario = usuarioFalso(null, new Date().toISOString());

    await useCase.execute({ novaSenha: "nova-senha-123" });
    await useCase.execute({ novaSenha: "nova-senha-123" });

    expect(sessao.chamadasTrocar).toBe(0);
    expect(finalizar.auditoriasGravadas).toHaveLength(1);
  });

  it("falha ao gravar a prova + falha na finalização: retry cai em same_password e é recusado, nunca finaliza sem prova", async () => {
    const { sessao, usuarios, finalizar, useCase } = montar();
    usuarios.usuario = usuarioFalso(null);
    finalizar.erroAoRegistrarProva = new ForbiddenError("indisponível");
    finalizar.falhasRestantes = 1;
    expect((await useCase.execute({ novaSenha: "nova-senha-123" })).ok).toBe(false);

    sessao.erroAoTrocar = new SenhaJaDefinidaFalsa("A nova senha é igual à senha atual.");
    const retry = await useCase.execute({ novaSenha: "nova-senha-123" });

    expect(retry.ok).toBe(false);
    if (!retry.ok) expect(retry.error).toBeInstanceOf(ValidationError);
    expect(finalizar.marcada).toBe(false);
  });

  it("troca voluntária: auditoria que falha devolve EstadoInconsistenteError e o retry registra 1 vez", async () => {
    const { sessao, usuarios, auditoria, useCase } = montar();
    usuarios.usuario = usuarioFalso(new Date().toISOString());
    auditoria.erro = new ForbiddenError("Falha ao registrar auditoria: indisponível");

    const primeira = await useCase.execute({ novaSenha: "nova-senha-123" });
    expect(primeira.ok).toBe(false);
    if (!primeira.ok) expect(primeira.error).toBeInstanceOf(EstadoInconsistenteError);

    auditoria.erro = null;
    sessao.erroAoTrocar = new SenhaJaDefinidaFalsa("A nova senha é igual à senha atual.");
    const retry = await useCase.execute({ novaSenha: "nova-senha-123" });

    expect(retry.ok).toBe(true);
    expect(auditoria.registros).toEqual([
      expect.objectContaining({ acao: "usuario.trocar_senha" }),
    ]);
  });

  // Devolutiva técnica PR #62, ponto 1: same_password sem prova de Auth alterado
  //  não pode virar sucesso — senão o usuário "troca" a senha pra ela
  // mesma (a provisória) e o sistema marca a troca como concluída sem nada mudar.
  it("rejeita quando a nova senha é igual à provisória (primeiro acesso, sem prova de Auth alterado)", async () => {
    const { sessao, usuarios, finalizar, auditoria, useCase } = montar();
    sessao.erroAoTrocar = new SenhaJaDefinidaFalsa("A nova senha é igual à senha atual.");
    usuarios.usuario = usuarioFalso(null);

    const resultado = await useCase.execute({ novaSenha: "senha-provisoria-123" });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toBeInstanceOf(ValidationError);
    expect(finalizar.marcada).toBe(false);
    expect(finalizar.provaGravada).toBe(false);
    expect(auditoria.registros).toEqual([]);
  });

  it("troca voluntária: same_password é reenvio legítimo (audita 1 vez, sem finalizar perfil)", async () => {
    const { sessao, usuarios, finalizar, auditoria, useCase } = montar();
    sessao.erroAoTrocar = new SenhaJaDefinidaFalsa("A nova senha é igual à senha atual.");
    usuarios.usuario = usuarioFalso(new Date().toISOString());

    const resultado = await useCase.execute({ novaSenha: "nova-senha-definitiva-123" });

    expect(resultado.ok).toBe(true);
    expect(finalizar.provaGravada).toBe(false);
    expect(auditoria.registros).toEqual([
      expect.objectContaining({ acao: "usuario.trocar_senha" }),
    ]);
  });
});
