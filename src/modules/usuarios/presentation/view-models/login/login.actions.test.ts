/**
 * Integração presentation ↔ application: o `main` é substituído por uma
 * composição com portas OUT falsas (testes.md, seção 3), sem tocar Supabase real.
 */
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok } from "@/shared/kernel/result";

import { loginAction } from "./login.actions";

const executeMock = jest.fn();

jest.mock("@/main/usuarios.factory", () => ({
  makeLogin: () => ({ execute: executeMock }),
}));

describe("loginAction (integração)", () => {
  beforeEach(() => executeMock.mockReset());

  it("devolve VALIDATION_ERROR sem chamar o caso de uso quando o input é inválido", async () => {
    const resultado = await loginAction({ email: "não-é-email", senha: "" });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error.code).toBe("VALIDATION_ERROR");
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("devolve o ActionResult de sucesso do caso de uso quando o input é válido", async () => {
    executeMock.mockResolvedValue(
      ok({
        id: "1",
        nome: "Admin",
        email: "admin@rigonicontabil.local",
        papel: "admin",
        setor: "administrativo",
      }),
    );

    const resultado = await loginAction({ email: "admin@rigonicontabil.local", senha: "admin123" });

    expect(resultado).toEqual({
      ok: true,
      data: {
        id: "1",
        nome: "Admin",
        email: "admin@rigonicontabil.local",
        papel: "admin",
        setor: "administrativo",
      },
    });
  });

  it("devolve o ActionResult de erro do caso de uso quando a autenticação falha", async () => {
    executeMock.mockResolvedValue(err(new ForbiddenError("E-mail ou senha inválidos.")));

    const resultado = await loginAction({ email: "x@x.com", senha: "errada" });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error.code).toBe("FORBIDDEN");
  });
});
