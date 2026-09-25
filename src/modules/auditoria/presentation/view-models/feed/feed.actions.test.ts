/**
 * Integração presentation ↔ application: o `main` é substituído por uma
 * composição com portas OUT falsas (testes.md, seção 3), sem tocar Supabase real.
 */
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok } from "@/shared/kernel/result";

import { listarRegistrosAction } from "./feed.actions";

const executeMock = jest.fn();

jest.mock("@/main/auditoria.factory", () => ({
  makeListarRegistros: () => ({ execute: executeMock }),
}));

describe("listarRegistrosAction (integração)", () => {
  beforeEach(() => executeMock.mockReset());

  it("devolve VALIDATION_ERROR sem chamar o caso de uso quando o período é inválido", async () => {
    const resultado = await listarRegistrosAction({ dataInicio: "não-é-data" });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error.code).toBe("VALIDATION_ERROR");
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("repassa o filtro validado ao caso de uso e devolve os dados", async () => {
    executeMock.mockResolvedValue(ok([]));

    const resultado = await listarRegistrosAction({ setor: "administrativo" });

    expect(resultado).toEqual({ ok: true, data: [] });
    expect(executeMock).toHaveBeenCalledWith({ setor: "administrativo" });
  });

  it("devolve o ActionResult de erro do caso de uso (ex.: Forbidden)", async () => {
    executeMock.mockResolvedValue(err(new ForbiddenError("Só Admin acessa o feed de auditoria.")));

    const resultado = await listarRegistrosAction({});

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error.code).toBe("FORBIDDEN");
  });
});
