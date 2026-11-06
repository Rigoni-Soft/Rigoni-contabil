import type { AlteracaoPapelPort } from "@/modules/usuarios/application/ports/out/alteracao-papel.provider";
import type { SessaoPort } from "@/modules/usuarios/application/ports/out/sessao.provider";
import type { UsuarioRepository } from "@/modules/usuarios/application/ports/out/usuario.repository";
import { Usuario, type UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import { AppError } from "@/shared/errors/app.error";
import { err, ok, type Result } from "@/shared/kernel/result";

import { AlterarPapelUsuario } from "./alterar-papel-usuario.use-case";

class FalhaTecnica extends AppError {
  readonly code = "PERSISTENCIA_ERROR";
}

function usuario(id: string, papel: string, setor = "simples_nacional", desativado = false) {
  const b = Usuario.builder()
    .comId(id)
    .comNome(`Nome ${id}`)
    .comEmail(`${id}@rigonicontabil.local`)
    .comPapel(papel)
    .comSetor(setor);
  const resultado = (desativado ? b.comDesativadoEm(new Date().toISOString()) : b).build();
  if (!resultado.ok) throw new Error("setup inválido");
  return resultado.value;
}

const ADMIN = () => usuario("admin-1", "admin", "administrativo");

function montar(opcoes: { atorId?: string | null; perfis?: Usuario[] } = {}) {
  const perfis = opcoes.perfis ?? [ADMIN(), usuario("func-1", "funcionario")];
  const chamadas: string[] = [];
  const falhas: { alterar?: AppError; buscar?: AppError } = {};

  const sessao = {
    usuarioAtualId: async () => (opcoes.atorId === undefined ? "admin-1" : opcoes.atorId),
  } as unknown as SessaoPort;
  const usuarios = {
    buscarPorId: async (id: UsuarioId): Promise<Result<Usuario | null, AppError>> =>
      falhas.buscar ? err(falhas.buscar) : ok(perfis.find((p) => p.id === id) ?? null),
    buscarLiderAtivoDoSetor: async (setor: { slug: string }) =>
      ok(
        perfis.find(
          (p) => p.papel.ehLiderSetor() && p.setor.slug === setor.slug && !p.estaDesativado(),
        ) ?? null,
      ),
  } as unknown as UsuarioRepository;
  const alteracao: AlteracaoPapelPort = {
    alterar: async (alvo, ator, papel) => {
      chamadas.push(`alterar:${alvo}:${ator}:${papel}`);
      return falhas.alterar ? err(falhas.alterar) : ok(undefined);
    },
  };

  return { casoDeUso: new AlterarPapelUsuario(sessao, usuarios, alteracao), chamadas, falhas };
}

describe("AlterarPapelUsuario", () => {
  it("Admin rebaixa Líder para Funcionário", async () => {
    const { casoDeUso, chamadas } = montar({
      perfis: [ADMIN(), usuario("lider-1", "lider_setor")],
    });

    const r = await casoDeUso.execute({ usuarioId: "lider-1", papel: "funcionario" });

    expect(r.ok).toBe(true);
    expect(chamadas).toEqual(["alterar:lider-1:admin-1:funcionario"]);
  });

  it("Admin promove Funcionário quando o Setor não tem Líder ativo", async () => {
    const { casoDeUso, chamadas } = montar();

    expect((await casoDeUso.execute({ usuarioId: "func-1", papel: "lider_setor" })).ok).toBe(true);
    expect(chamadas).toEqual(["alterar:func-1:admin-1:lider_setor"]);
  });

  it("Líder desativado do Setor não conta: promoção é permitida", async () => {
    const { casoDeUso } = montar({
      perfis: [
        ADMIN(),
        usuario("func-1", "funcionario"),
        usuario("lider-velho", "lider_setor", "simples_nacional", true),
      ],
    });

    expect((await casoDeUso.execute({ usuarioId: "func-1", papel: "lider_setor" })).ok).toBe(true);
  });

  it("Líder de outro Setor não impede a promoção", async () => {
    const { casoDeUso } = montar({
      perfis: [
        ADMIN(),
        usuario("func-1", "funcionario"),
        usuario("lider-2", "lider_setor", "financeiro"),
      ],
    });

    expect((await casoDeUso.execute({ usuarioId: "func-1", papel: "lider_setor" })).ok).toBe(true);
  });

  it("recusa promover quando o Setor já tem Líder ativo, exigindo rebaixar o atual antes", async () => {
    const { casoDeUso, chamadas } = montar({
      perfis: [ADMIN(), usuario("func-1", "funcionario"), usuario("lider-1", "lider_setor")],
    });

    const r = await casoDeUso.execute({ usuarioId: "func-1", papel: "lider_setor" });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("VALIDATION_ERROR");
      expect(r.error.message).toMatch(/Nome lider-1.*Rebaixe/);
    }
    expect(chamadas).toEqual([]);
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
          usuario("admin-1", "admin", "administrativo", true),
          usuario("func-1", "funcionario"),
        ],
      },
      "func-1",
    ],
    ["alvo é a própria conta", {}, "admin-1"],
    ["alvo é outro Admin", { perfis: [ADMIN(), usuario("admin-2", "admin")] }, "admin-2"],
  ])("recusa por permissão (%s) sem tocar em nada", async (_nome, opcoes, alvo) => {
    const { casoDeUso, chamadas } = montar(opcoes);

    const r = await casoDeUso.execute({ usuarioId: alvo, papel: "funcionario" });

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("FORBIDDEN");
    expect(chamadas).toEqual([]);
  });

  it.each([
    [
      "alvo desativado",
      [ADMIN(), usuario("func-1", "funcionario", "simples_nacional", true)],
      "func-1",
      "lider_setor",
    ],
    ["alvo inexistente", undefined, "fantasma", "funcionario"],
    ["papel admin", undefined, "func-1", "admin"],
    ["papel inválido", undefined, "func-1", "xyz"],
    ["já está no papel", undefined, "func-1", "funcionario"],
  ])("recusa com erro de validação (%s)", async (_n, perfis, alvo, papel) => {
    const { casoDeUso, chamadas } = montar({ perfis });

    const r = await casoDeUso.execute({ usuarioId: alvo, papel });

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("VALIDATION_ERROR");
    expect(chamadas).toEqual([]);
  });

  it("erro técnico ao buscar perfil propaga o erro original", async () => {
    const { casoDeUso, falhas } = montar();
    falhas.buscar = new FalhaTecnica("banco fora");

    const r = await casoDeUso.execute({ usuarioId: "func-1", papel: "lider_setor" });

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("PERSISTENCIA_ERROR");
  });

  it("propaga o erro da RPC (ex.: corrida: Setor ganhou Líder entre a checagem e a troca)", async () => {
    const { casoDeUso, falhas } = montar();
    falhas.alterar = new FalhaTecnica("rpc falhou");

    const r = await casoDeUso.execute({ usuarioId: "func-1", papel: "lider_setor" });

    expect(r.ok).toBe(false);
  });
});
