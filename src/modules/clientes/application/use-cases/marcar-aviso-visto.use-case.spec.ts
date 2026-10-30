import type { AvisosCadastroPort } from "@/modules/clientes/application/ports/out/avisos-cadastro.provider";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import { ok } from "@/shared/kernel/result";

import { MarcarAvisoVisto } from "./marcar-aviso-visto.use-case";

function gatewayFalso() {
  const marcarVisto = jest.fn<
    ReturnType<AvisosCadastroPort["marcarVisto"]>,
    Parameters<AvisosCadastroPort["marcarVisto"]>
  >(async () => ok(undefined));
  const gateway: AvisosCadastroPort = {
    listar: async () => ok([]),
    contarNaoVistos: async () => ok(0),
    marcarVisto,
  };
  return { gateway, marcarVisto };
}

describe("MarcarAvisoVisto (#142)", () => {
  it("exige sessão", async () => {
    const semSessao: SessaoPort = { usuarioAtual: async () => null };
    const { gateway, marcarVisto } = gatewayFalso();

    const resultado = await new MarcarAvisoVisto(semSessao, gateway).execute("a1");

    expect(resultado.ok).toBe(false);
    expect(marcarVisto).not.toHaveBeenCalled();
  });

  it("marca o aviso pelo gateway", async () => {
    const comSessao: SessaoPort = {
      usuarioAtual: async () => ({ id: "u1", papel: "funcionario", setor: "simples_nacional" }),
    };
    const { gateway, marcarVisto } = gatewayFalso();

    const resultado = await new MarcarAvisoVisto(comSessao, gateway).execute("a1");

    expect(resultado.ok).toBe(true);
    expect(marcarVisto).toHaveBeenCalledWith("a1");
  });
});
