import type { AvisosCadastroPort } from "@/modules/clientes/application/ports/out/avisos-cadastro.provider";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import { ok } from "@/shared/kernel/result";

import { ContarAvisosNaoVistos } from "./contar-avisos-nao-vistos.use-case";

const gateway: AvisosCadastroPort = {
  listar: async () => ok([]),
  contarNaoVistos: async () => ok(4),
  marcarVisto: async () => ok(undefined),
};

describe("ContarAvisosNaoVistos (#142)", () => {
  it("exige sessão", async () => {
    const semSessao: SessaoPort = { usuarioAtual: async () => null };

    const resultado = await new ContarAvisosNaoVistos(semSessao, gateway).execute();

    expect(resultado.ok).toBe(false);
  });

  it("devolve a contagem do gateway", async () => {
    const comSessao: SessaoPort = {
      usuarioAtual: async () => ({ id: "u1", papel: "funcionario", setor: "simples_nacional" }),
    };

    const resultado = await new ContarAvisosNaoVistos(comSessao, gateway).execute();

    expect(resultado).toEqual({ ok: true, value: 4 });
  });
});
