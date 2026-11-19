import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import type { TiposDeEnvioDoContatoRepository } from "@/modules/clientes/application/ports/out/tipos-de-envio-do-contato.repository";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok } from "@/shared/kernel/result";

import { DefinirTiposDeEnvioDoContato } from "./definir-tipos-de-envio-do-contato.use-case";

const CLIENTE = "11111111-1111-1111-1111-111111111111";
const CONTATO = "22222222-2222-2222-2222-222222222222";

function montar(
  ator: { papel: string; setor: string } | null = { papel: "funcionario", setor: "rh" },
) {
  const chamadas: unknown[][] = [];
  const sessao: SessaoPort = { usuarioAtual: async () => (ator ? { id: "u1", ...ator } : null) };
  const repositorio: TiposDeEnvioDoContatoRepository = {
    definir: async (...args) => {
      chamadas.push(args);
      return ok(undefined);
    },
  };
  return { caso: new DefinirTiposDeEnvioDoContato(sessao, repositorio), chamadas };
}

describe("DefinirTiposDeEnvioDoContato", () => {
  it("grava os tipos sem repetição nem vazios", async () => {
    const { caso, chamadas } = montar();

    const r = await caso.execute({
      clienteId: CLIENTE,
      contatoId: CONTATO,
      tipos: ["das", " das ", "", "todos"],
    });

    expect(r.ok).toBe(true);
    expect(chamadas).toEqual([[CLIENTE, CONTATO, ["das", "todos"]]]);
  });

  it("lista vazia tira o contato dos envios do Setor", async () => {
    const { caso, chamadas } = montar();

    await caso.execute({ clienteId: CLIENTE, contatoId: CONTATO, tipos: [] });

    expect(chamadas).toEqual([[CLIENTE, CONTATO, []]]);
  });

  it("recusa sem sessão e o Admin (sem Setor), sem gravar", async () => {
    for (const ator of [null, { papel: "admin", setor: "administrativo" }]) {
      const { caso, chamadas } = montar(ator);

      const r = await caso.execute({ clienteId: CLIENTE, contatoId: CONTATO, tipos: ["das"] });

      expect(r.ok).toBe(false);
      expect(chamadas).toEqual([]);
    }
  });

  it("devolve o erro do repositório", async () => {
    const sessao: SessaoPort = {
      usuarioAtual: async () => ({ id: "u1", papel: "funcionario", setor: "rh" }),
    };
    const caso = new DefinirTiposDeEnvioDoContato(sessao, {
      definir: async () => err(new ValidationError("tipo inválido")),
    });

    const r = await caso.execute({ clienteId: CLIENTE, contatoId: CONTATO, tipos: ["x"] });

    expect(!r.ok && r.error.message).toBe("tipo inválido");
  });
});
