/**
 * Integração presentation ↔ application: o `main` é substituído por uma composição com o caso de
 * uso falso (testes.md, seção 3), sem tocar Supabase real.
 */
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok } from "@/shared/kernel/result";

import { definirTiposDoContatoAction } from "./tipos-de-envio.actions";

const executeMock = jest.fn();

jest.mock("@/main/clientes.factory", () => ({
  makeDefinirTiposDeEnvioDoContato: () => ({ execute: executeMock }),
}));

const VALIDO = {
  clienteId: "c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1",
  contatoId: "d2d2d2d2-d2d2-4d2d-8d2d-d2d2d2d2d2d2",
  tipos: ["das"],
};

describe("definirTiposDoContatoAction (integração)", () => {
  beforeEach(() => executeMock.mockReset());

  it("entrada inválida: VALIDATION_ERROR, sem chamar o caso de uso", async () => {
    const resultado = await definirTiposDoContatoAction({ ...VALIDO, contatoId: "abc" });

    expect(resultado).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("entrada válida chama o caso de uso", async () => {
    executeMock.mockResolvedValue(ok(undefined));

    const resultado = await definirTiposDoContatoAction(VALIDO);

    expect(executeMock).toHaveBeenCalledWith(VALIDO);
    expect(resultado.ok).toBe(true);
  });

  it("erro do caso de uso vira ActionResult de falha", async () => {
    executeMock.mockResolvedValue(err(new ForbiddenError("Sem permissão.")));

    const resultado = await definirTiposDoContatoAction(VALIDO);

    expect(resultado).toMatchObject({ ok: false, error: { message: "Sem permissão." } });
  });
});
