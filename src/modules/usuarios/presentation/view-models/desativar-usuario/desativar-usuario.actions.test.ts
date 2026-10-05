/**
 * Integração presentation ↔ application: o `main` é substituído por portas falsas
 * (testes.md, seção 3), sem tocar Supabase real.
 */
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok } from "@/shared/kernel/result";

import { desativarUsuarioAction } from "./desativar-usuario.actions";

const executeMock = jest.fn();

jest.mock("@/main/usuarios.factory", () => ({
  makeDesativarUsuario: () => ({ execute: executeMock }),
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

const ID = "11111111-1111-4111-8111-111111111111";

describe("desativarUsuarioAction (integração)", () => {
  beforeEach(() => executeMock.mockReset());

  it("devolve VALIDATION_ERROR sem chamar o caso de uso quando o id não é UUID", async () => {
    const resultado = await desativarUsuarioAction({ usuarioId: "nao-uuid" });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error.code).toBe("VALIDATION_ERROR");
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("devolve sucesso quando o caso de uso desativa", async () => {
    executeMock.mockResolvedValue(ok(undefined));

    expect((await desativarUsuarioAction({ usuarioId: ID })).ok).toBe(true);
    expect(executeMock).toHaveBeenCalledWith({ usuarioId: ID });
  });

  it("devolve o erro do caso de uso (ex.: Forbidden)", async () => {
    executeMock.mockResolvedValue(err(new ForbiddenError("Só Admin desativa usuários.")));

    const resultado = await desativarUsuarioAction({ usuarioId: ID });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error.code).toBe("FORBIDDEN");
  });
});
