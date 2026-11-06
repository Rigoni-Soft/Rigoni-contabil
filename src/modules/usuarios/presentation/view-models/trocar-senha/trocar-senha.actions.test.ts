/**
 * Integração presentation ↔ application: o `main` é substituído por uma
 * composição com portas OUT falsas (testes.md, seção 3), sem tocar Supabase real.
 */
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok } from "@/shared/kernel/result";

import { trocarSenhaAction } from "./trocar-senha.actions";

const executeMock = jest.fn();

jest.mock("@/main/usuarios.factory", () => ({
  makeTrocarSenha: () => ({ execute: executeMock }),
}));

describe("trocarSenhaAction (integração)", () => {
  beforeEach(() => executeMock.mockReset());

  it("devolve VALIDATION_ERROR sem chamar o caso de uso quando as senhas não coincidem", async () => {
    const resultado = await trocarSenhaAction({
      novaSenha: "senha-nova-123",
      confirmacao: "outra-coisa",
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error.code).toBe("VALIDATION_ERROR");
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("devolve o ActionResult de sucesso do caso de uso quando o input é válido", async () => {
    executeMock.mockResolvedValue(ok(undefined));

    const resultado = await trocarSenhaAction({
      novaSenha: "senha-nova-123",
      confirmacao: "senha-nova-123",
    });

    expect(resultado.ok).toBe(true);
    expect(executeMock).toHaveBeenCalledWith({ novaSenha: "senha-nova-123" });
  });

  it("devolve o ActionResult de erro do caso de uso (ex.: sessão inválida)", async () => {
    executeMock.mockResolvedValue(err(new ForbiddenError("Sessão inválida.")));

    const resultado = await trocarSenhaAction({
      novaSenha: "senha-nova-123",
      confirmacao: "senha-nova-123",
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error.code).toBe("FORBIDDEN");
  });
});
