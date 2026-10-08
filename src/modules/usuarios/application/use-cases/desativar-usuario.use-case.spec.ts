import type { AuthAdminPort } from "@/modules/usuarios/application/ports/out/auth-admin.provider";
import type { DesativacaoPort } from "@/modules/usuarios/application/ports/out/desativacao.provider";
import type { SessaoPort } from "@/modules/usuarios/application/ports/out/sessao.provider";
import type { UsuarioRepository } from "@/modules/usuarios/application/ports/out/usuario.repository";
import { Usuario, type UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import { AppError } from "@/shared/errors/app.error";
import { err, ok, type Result } from "@/shared/kernel/result";

import { DesativarUsuario } from "./desativar-usuario.use-case";

class FalhaTecnica extends AppError {
  readonly code = "PERSISTENCIA_ERROR";
}

function usuario(id: string, papel: string): Usuario {
  const resultado = Usuario.builder()
    .comId(id)
    .comNome(`Nome ${id}`)
    .comEmail(`${id}@rigonicontabil.local`)
    .comPapel(papel)
    .comSetor("simples_nacional")
    .build();
  if (!resultado.ok) throw new Error("setup inválido");
  return resultado.value;
}

function montar(opcoes: { atorId?: string | null; perfis?: Usuario[] } = {}) {
  const perfis = opcoes.perfis ?? [usuario("admin-1", "admin"), usuario("func-1", "funcionario")];
  const chamadas: string[] = [];
  const falhas: {
    desativar?: AppError;
    banir?: AppError;
    bloquear?: AppError;
    buscar?: AppError;
  } = {};

  const sessao = {
    usuarioAtualId: async () => (opcoes.atorId === undefined ? "admin-1" : opcoes.atorId),
  } as unknown as SessaoPort;
  const usuarios = {
    buscarPorId: async (id: UsuarioId): Promise<Result<Usuario | null, AppError>> =>
      falhas.buscar ? err(falhas.buscar) : ok(perfis.find((p) => p.id === id) ?? null),
  } as unknown as UsuarioRepository;
  const desativacao: DesativacaoPort = {
    desativar: async (alvo, ator) => {
      chamadas.push(`desativar:${alvo}:${ator}`);
      return falhas.desativar ? err(falhas.desativar) : ok(undefined);
    },
    registrarBloqueio: async (alvo) => {
      chamadas.push(`bloquear:${alvo}`);
      return falhas.bloquear ? err(falhas.bloquear) : ok(undefined);
    },
  };
  const authAdmin = {
    banirConta: async (id: string) => {
      chamadas.push(`banir:${id}`);
      return falhas.banir ? err(falhas.banir) : ok(undefined);
    },
  } as unknown as AuthAdminPort;

  return {
    casoDeUso: new DesativarUsuario(sessao, usuarios, desativacao, authAdmin),
    chamadas,
    falhas,
  };
}

describe("DesativarUsuario", () => {
  it("Admin desativa Funcionário: marca/audita e depois bane a conta", async () => {
    const { casoDeUso, chamadas } = montar();

    const resultado = await casoDeUso.execute({ usuarioId: "func-1" });

    expect(resultado.ok).toBe(true);
    expect(chamadas).toEqual(["desativar:func-1:admin-1", "banir:func-1", "bloquear:func-1"]);
  });

  it("Admin desativa Líder de setor", async () => {
    const { casoDeUso, chamadas } = montar({
      perfis: [usuario("admin-1", "admin"), usuario("lider-1", "lider_setor")],
    });

    expect((await casoDeUso.execute({ usuarioId: "lider-1" })).ok).toBe(true);
    expect(chamadas).toContain("banir:lider-1");
  });

  it.each([
    ["sem sessão", { atorId: null }, "func-1"],
    [
      "ator Líder",
      {
        atorId: "lider-1",
        perfis: [usuario("lider-1", "lider_setor"), usuario("func-1", "funcionario")],
      },
      "func-1",
    ],
    [
      "ator Admin desativado",
      {
        perfis: [
          (() => {
            const r = Usuario.builder()
              .comId("admin-1")
              .comNome("Nome admin-1")
              .comEmail("admin-1@rigonicontabil.local")
              .comPapel("admin")
              .comSetor("simples_nacional")
              .comDesativadoEm(new Date().toISOString())
              .build();
            if (!r.ok) throw new Error("setup inválido");
            return r.value;
          })(),
          usuario("func-1", "funcionario"),
        ],
      },
      "func-1",
    ],
    ["alvo é a própria conta", {}, "admin-1"],
    [
      "alvo é outro Admin",
      { perfis: [usuario("admin-1", "admin"), usuario("admin-2", "admin")] },
      "admin-2",
    ],
  ])("recusa (%s) sem tocar em nada", async (_nome, opcoes, alvo) => {
    const { casoDeUso, chamadas } = montar(opcoes);

    const resultado = await casoDeUso.execute({ usuarioId: alvo });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error.code).toBe("FORBIDDEN");
    expect(chamadas).toEqual([]);
  });

  it("alvo inexistente devolve erro de validação", async () => {
    const { casoDeUso, chamadas } = montar();

    const resultado = await casoDeUso.execute({ usuarioId: "fantasma" });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error.code).toBe("VALIDATION_ERROR");
    expect(chamadas).toEqual([]);
  });

  it("erro técnico ao buscar perfil propaga o erro original", async () => {
    const { casoDeUso, falhas } = montar();
    falhas.buscar = new FalhaTecnica("banco fora");

    const resultado = await casoDeUso.execute({ usuarioId: "func-1" });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error.code).toBe("PERSISTENCIA_ERROR");
  });

  it("falha ao marcar/auditar não bane a conta", async () => {
    const { casoDeUso, chamadas, falhas } = montar();
    falhas.desativar = new FalhaTecnica("rpc falhou");

    const resultado = await casoDeUso.execute({ usuarioId: "func-1" });

    expect(resultado.ok).toBe(false);
    expect(chamadas).toEqual(["desativar:func-1:admin-1"]);
  });

  it("falha no ban devolve o erro e não registra o bloqueio (fica pendente na lista)", async () => {
    const { casoDeUso, chamadas, falhas } = montar();
    falhas.banir = new FalhaTecnica("auth fora");

    const resultado = await casoDeUso.execute({ usuarioId: "func-1" });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.code).toBe("INCONSISTENT_STATE");
      expect(resultado.error.message).toMatch(/Usuário desativado, mas o bloqueio da conta falhou/);
    }
    expect(chamadas).not.toContain("bloquear:func-1");
  });

  it("falha ao registrar o bloqueio também fica pendente, sem sucesso total", async () => {
    const { casoDeUso, falhas } = montar();
    falhas.bloquear = new FalhaTecnica("banco fora");

    const resultado = await casoDeUso.execute({ usuarioId: "func-1" });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error.code).toBe("INCONSISTENT_STATE");
  });

  it("repetir sobre conta já desativada conclui o bloqueio pendente", async () => {
    const { casoDeUso, chamadas } = montar();

    await casoDeUso.execute({ usuarioId: "func-1" });
    await casoDeUso.execute({ usuarioId: "func-1" });

    expect(chamadas.filter((c) => c === "banir:func-1")).toHaveLength(2);
  });
});
