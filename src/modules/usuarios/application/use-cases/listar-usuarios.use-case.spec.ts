import type { SessaoPort } from "@/modules/usuarios/application/ports/out/sessao.provider";
import type { UsuarioRepository } from "@/modules/usuarios/application/ports/out/usuario.repository";
import { Usuario, type UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import { ok } from "@/shared/kernel/result";

import { ListarUsuarios } from "./listar-usuarios.use-case";

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

function montar(atorId: string | null, ator: Usuario | null) {
  const sessao = { usuarioAtualId: async () => atorId } as unknown as SessaoPort;
  const usuarios = {
    buscarPorId: async () => ok(ator),
    listarAtivos: async () => ok([usuario("admin-1", "admin"), usuario("func-1", "funcionario")]),
  } as unknown as UsuarioRepository;
  return new ListarUsuarios(sessao, usuarios);
}

describe("ListarUsuarios", () => {
  it("Admin recebe os usuários ativos como DTO", async () => {
    const resultado = await montar("admin-1", usuario("admin-1", "admin")).execute();

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.value.map((u) => u.id)).toEqual(["admin-1", "func-1"]);
  });

  it.each([
    ["sem sessão", null, null],
    ["Líder", "lider-1", usuario("lider-1", "lider_setor")],
    ["Funcionário", "func-1", usuario("func-1", "funcionario")],
  ])("recusa %s", async (_nome, atorId, ator) => {
    const resultado = await montar(atorId, ator).execute();

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error.code).toBe("FORBIDDEN");
  });
});
