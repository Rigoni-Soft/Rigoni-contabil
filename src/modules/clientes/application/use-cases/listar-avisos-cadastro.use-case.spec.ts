import type { AvisoCadastroDto } from "@/modules/clientes/application/dtos/aviso-cadastro.dto";
import type { AvisosCadastroPort } from "@/modules/clientes/application/ports/out/avisos-cadastro.provider";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import { ok } from "@/shared/kernel/result";

import { ListarAvisosCadastro } from "./listar-avisos-cadastro.use-case";

const comSessao: SessaoPort = {
  usuarioAtual: async () => ({ id: "u1", papel: "lider_setor", setor: "simples_nacional" }),
};
const semSessao: SessaoPort = { usuarioAtual: async () => null };

function aviso(n: number): AvisoCadastroDto {
  return {
    id: `a${n}`,
    tipo: "novo_cliente",
    clienteId: "c1",
    alteracaoId: null,
    criadoEm: `2026-02-01T10:${String(n).padStart(2, "0")}:00+00:00`,
    vistoEm: null,
  };
}

function gatewayCom(avisos: AvisoCadastroDto[]) {
  const listar = jest.fn<
    ReturnType<AvisosCadastroPort["listar"]>,
    Parameters<AvisosCadastroPort["listar"]>
  >(async () => ok(avisos));
  const gateway: AvisosCadastroPort = {
    listar,
    contarNaoVistos: async () => ok(0),
    marcarVisto: async () => ok(undefined),
  };
  return { gateway, listar };
}

describe("ListarAvisosCadastro (#142)", () => {
  it("exige sessão", async () => {
    const { gateway, listar } = gatewayCom([]);

    const resultado = await new ListarAvisosCadastro(semSessao, gateway).execute(null);

    expect(resultado.ok).toBe(false);
    expect(listar).not.toHaveBeenCalled();
  });

  it("pede 31 ao gateway e, com sobra, devolve 30 e o cursor do último", async () => {
    const trintaEUm = Array.from({ length: 31 }, (_, i) => aviso(i));
    const { gateway, listar } = gatewayCom(trintaEUm);
    const cursor = { visto: false, criadoEm: "2026-01-01T00:00:00+00:00", id: "x" };

    const resultado = await new ListarAvisosCadastro(comSessao, gateway).execute(cursor);

    expect(listar).toHaveBeenCalledWith(cursor, 31);
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.value.itens).toHaveLength(30);
      expect(resultado.value.proximoCursor).toEqual({
        visto: false,
        criadoEm: aviso(29).criadoEm,
        id: "a29",
      });
    }
  });

  it("sem sobra, é a última página (sem cursor)", async () => {
    const { gateway } = gatewayCom([aviso(1), aviso(2)]);

    const resultado = await new ListarAvisosCadastro(comSessao, gateway).execute(null);

    expect(resultado).toEqual({
      ok: true,
      value: { itens: [aviso(1), aviso(2)], proximoCursor: null },
    });
  });
});
