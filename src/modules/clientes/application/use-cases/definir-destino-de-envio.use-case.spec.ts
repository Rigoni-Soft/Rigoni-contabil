import type { DestinoDeEnvioRepository } from "@/modules/clientes/application/ports/out/destino-de-envio.repository";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok } from "@/shared/kernel/result";

import { DefinirDestinoDeEnvio } from "./definir-destino-de-envio.use-case";
import { RemoverDestinoDeEnvio } from "./remover-destino-de-envio.use-case";

const CLIENTE = "11111111-1111-1111-1111-111111111111";

function montar(
  ator: { papel: string; setor: string } | null = { papel: "funcionario", setor: "rh" },
) {
  const definidos: unknown[][] = [];
  const removidos: string[] = [];
  const sessao: SessaoPort = { usuarioAtual: async () => (ator ? { id: "u1", ...ator } : null) };
  const repositorio: DestinoDeEnvioRepository = {
    definir: async (...args) => {
      definidos.push(args);
      return ok({ destinoId: "d-1", contatoId: "c-1" });
    },
    remover: async (id) => {
      removidos.push(id);
      return ok(undefined);
    },
  };
  return {
    definir: new DefinirDestinoDeEnvio(sessao, repositorio),
    remover: new RemoverDestinoDeEnvio(sessao, repositorio),
    definidos,
    removidos,
  };
}

describe("DefinirDestinoDeEnvio", () => {
  it("grava o Destino validado e devolve os ids", async () => {
    const { definir, definidos } = montar();

    const r = await definir.execute({
      clienteId: CLIENTE,
      contato: { id: "c-1" },
      tipo: "das",
      canal: "email",
    });

    expect(r.ok && r.value).toEqual({ destinoId: "d-1", contatoId: "c-1" });
    expect(definidos).toHaveLength(1);
    expect(definidos[0][0]).toBe(CLIENTE);
  });

  it("recusa sem sessão e o Admin (sem Setor), sem gravar", async () => {
    for (const ator of [null, { papel: "admin", setor: "administrativo" }]) {
      const { definir, definidos } = montar(ator);

      const r = await definir.execute({
        clienteId: CLIENTE,
        contato: { id: "c-1" },
        tipo: null,
        canal: "email",
      });

      expect(r.ok).toBe(false);
      expect(definidos).toEqual([]);
    }
  });

  it("recusa destino inválido (contato novo sem o canal escolhido), sem gravar", async () => {
    const { definir, definidos } = montar();

    const r = await definir.execute({
      clienteId: CLIENTE,
      contato: { novo: { nome: "Dora", telefone: "11999990000", email: "" } },
      tipo: null,
      canal: "email",
    });

    expect(!r.ok && r.error).toBeInstanceOf(ValidationError);
    expect(definidos).toEqual([]);
  });

  it("devolve o erro do repositório", async () => {
    const sessao: SessaoPort = {
      usuarioAtual: async () => ({ id: "u1", papel: "funcionario", setor: "rh" }),
    };
    const caso = new DefinirDestinoDeEnvio(sessao, {
      definir: async () => err(new ValidationError("repetido")),
      remover: async () => ok(undefined),
    });

    const r = await caso.execute({
      clienteId: CLIENTE,
      contato: { id: "c-1" },
      tipo: null,
      canal: "email",
    });

    expect(!r.ok && r.error.message).toBe("repetido");
  });
});

describe("RemoverDestinoDeEnvio", () => {
  it("remove o Destino", async () => {
    const { remover, removidos } = montar();

    const r = await remover.execute({ destinoId: "d-1" });

    expect(r.ok).toBe(true);
    expect(removidos).toEqual(["d-1"]);
  });

  it("recusa sem sessão, sem remover", async () => {
    const { remover, removidos } = montar(null);

    const r = await remover.execute({ destinoId: "d-1" });

    expect(r.ok).toBe(false);
    expect(removidos).toEqual([]);
  });
});
