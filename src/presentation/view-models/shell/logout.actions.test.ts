/**
 * Integração presentation ↔ application: o `main` é substituído por uma
 * composição com portas OUT falsas (testes.md, seção 3), sem tocar Supabase real.
 */
import { redirect } from "next/navigation";

import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok } from "@/shared/kernel/result";

import { logoutAction } from "./logout.actions";

const executeMock = jest.fn();

jest.mock("@/main/usuarios.factory", () => ({
  makeLogout: () => ({ execute: executeMock }),
}));

jest.mock("next/navigation", () => ({ redirect: jest.fn() }));

describe("logoutAction (integração)", () => {
  beforeEach(() => {
    executeMock.mockReset();
    jest.mocked(redirect).mockReset();
  });

  it("redireciona pro login quando encerrar a sessão funciona", async () => {
    executeMock.mockResolvedValue(ok(undefined));

    await logoutAction(null, new FormData());

    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("não finge logout: devolve estado de erro visível em vez de redirecionar quando encerrar a sessão falha", async () => {
    executeMock.mockResolvedValue(err(new ForbiddenError("falha ao encerrar")));

    const estado = await logoutAction(null, new FormData());

    expect(redirect).not.toHaveBeenCalledWith("/login");
    expect(estado?.erro).toBeTruthy();
  });
});
