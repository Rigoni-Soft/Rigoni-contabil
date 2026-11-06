/**
 * Integração presentation ↔ application: o `main` é substituído por portas falsas
 * (testes.md, seção 3), sem tocar Supabase real.
 */
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok } from "@/shared/kernel/result";

import { alterarPapelUsuarioAction } from "./alterar-papel.actions";

const executeMock = jest.fn();

jest.mock("@/main/usuarios.factory", () => ({
  makeAlterarPapelUsuario: () => ({ execute: executeMock }),
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

const ID = "11111111-1111-4111-8111-111111111111";

describe("alterarPapelUsuarioAction (integração)", () => {
  beforeEach(() => executeMock.mockReset());

  it.each([[{ usuarioId: "nao-uuid", papel: "lider_setor" }], [{ usuarioId: ID, papel: "admin" }]])(
    "devolve VALIDATION_ERROR sem chamar o caso de uso para entrada inválida",
    async (input) => {
      const resultado = await alterarPapelUsuarioAction(input);

      expect(resultado.ok).toBe(false);
      if (!resultado.ok) expect(resultado.error.code).toBe("VALIDATION_ERROR");
      expect(executeMock).not.toHaveBeenCalled();
    },
  );

  it("devolve sucesso quando o caso de uso altera o papel", async () => {
    executeMock.mockResolvedValue(ok(undefined));

    expect((await alterarPapelUsuarioAction({ usuarioId: ID, papel: "lider_setor" })).ok).toBe(
      true,
    );
    expect(executeMock).toHaveBeenCalledWith({ usuarioId: ID, papel: "lider_setor" });
  });

  it("devolve o erro do caso de uso (Setor já com Líder, Forbidden)", async () => {
    executeMock.mockResolvedValue(err(new ValidationError("Setor já tem Líder.")));
    const a = await alterarPapelUsuarioAction({ usuarioId: ID, papel: "lider_setor" });
    executeMock.mockResolvedValue(err(new ForbiddenError("Só Admin.")));
    const b = await alterarPapelUsuarioAction({ usuarioId: ID, papel: "funcionario" });

    expect(!a.ok && a.error.message).toBe("Setor já tem Líder.");
    expect(!b.ok && b.error.code).toBe("FORBIDDEN");
  });
});
