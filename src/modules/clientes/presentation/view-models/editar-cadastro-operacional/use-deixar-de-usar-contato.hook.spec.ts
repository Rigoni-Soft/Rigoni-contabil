import { renderHook } from "@testing-library/react";

import { useDeixarDeUsarContato } from "./use-deixar-de-usar-contato.hook";

const definirTipos = jest.fn();

jest.mock("./tipos-de-envio.actions", () => ({
  definirTiposDoContatoAction: (...a: unknown[]) => definirTipos(...a),
}));

const deixarDeUsar = () => renderHook(() => useDeixarDeUsarContato("cli-1")).result.current;

describe("useDeixarDeUsarContato", () => {
  beforeEach(() => definirTipos.mockReset());

  it("tira todos os envios do Setor no contato", async () => {
    definirTipos.mockResolvedValue({ ok: true, data: undefined });

    await expect(deixarDeUsar()("c-2")).resolves.toEqual({ ok: true });
    expect(definirTipos).toHaveBeenCalledWith({ clienteId: "cli-1", contatoId: "c-2", tipos: [] });
  });

  it("a falha do servidor volta dita, sem lançar", async () => {
    definirTipos.mockResolvedValue({ ok: false, error: { message: "Sem permissão." } });

    await expect(deixarDeUsar()("c-2")).resolves.toEqual({ ok: false, mensagem: "Sem permissão." });
  });
});
