/**
 * Integração presentation ↔ application: o `main` é substituído por uma
 * composição com portas OUT falsas (testes.md, seção 3), sem tocar Supabase real.
 */
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok } from "@/shared/kernel/result";

import { criarUsuarioAction } from "./criar-usuario.actions";

const executeMock = jest.fn();

jest.mock("@/main/usuarios.factory", () => ({
  makeCriarUsuario: () => ({ execute: executeMock }),
}));

describe("criarUsuarioAction (integração)", () => {
  beforeEach(() => executeMock.mockReset());

  it("devolve VALIDATION_ERROR sem chamar o caso de uso quando o input é inválido", async () => {
    const resultado = await criarUsuarioAction({
      nome: "",
      email: "não-é-email",
      papel: "funcionario",
      setor: "",
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error.code).toBe("VALIDATION_ERROR");
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("devolve o ActionResult de sucesso do caso de uso quando o input é válido", async () => {
    executeMock.mockResolvedValue(
      ok({
        usuario: {
          id: "1",
          nome: "Jéssica",
          email: "jessica@rigonicontabil.local",
          papel: "funcionario",
          setor: "simples_nacional",
        },
        senhaProvisoria: "ABCDEFGHJKLM",
      }),
    );

    const resultado = await criarUsuarioAction({
      nome: "Jéssica",
      email: "jessica@rigonicontabil.local",
      papel: "funcionario",
      setor: "simples_nacional",
    });

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.data.senhaProvisoria).toBe("ABCDEFGHJKLM");
  });

  it("devolve o ActionResult de erro do caso de uso (ex.: Forbidden)", async () => {
    executeMock.mockResolvedValue(err(new ForbiddenError("Só Admin cadastra Líder/Funcionário.")));

    const resultado = await criarUsuarioAction({
      nome: "Jéssica",
      email: "jessica@rigonicontabil.local",
      papel: "funcionario",
      setor: "simples_nacional",
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error.code).toBe("FORBIDDEN");
  });
});
