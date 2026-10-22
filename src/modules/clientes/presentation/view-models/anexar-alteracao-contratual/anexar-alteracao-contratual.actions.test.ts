/**
 * Integração presentation ↔ application: o `main` é substituído por uma composição com o caso de
 * uso falso (testes.md, seção 3), sem tocar Supabase real.
 */
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok } from "@/shared/kernel/result";

import { anexarAlteracaoContratualAction } from "./anexar-alteracao-contratual.actions";

const executeMock = jest.fn();

jest.mock("@/main/clientes.factory", () => ({
  makeAnexarAlteracaoContratual: () => ({ execute: executeMock }),
}));

const INPUT_VALIDO = {
  clienteId: "c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1",
  numero: 2,
  data: "2026-02-01",
  arquivo: new File(["conteúdo"], "2-alteracao.pdf", { type: "application/pdf" }),
};

describe("anexarAlteracaoContratualAction (integração)", () => {
  beforeEach(() => executeMock.mockReset());

  it.each([
    ["nº zero", { numero: 0 }, "numero"],
    ["data vazia", { data: "" }, "data"],
    ["data futura", { data: "2999-01-01" }, "data"],
    [
      "arquivo de outro tipo",
      { arquivo: new File(["x"], "a.png", { type: "image/png" }) },
      "arquivo",
    ],
    [
      "arquivo acima de 4 MB",
      {
        arquivo: new File([new Uint8Array(4 * 1024 * 1024 + 1)], "a.pdf", {
          type: "application/pdf",
        }),
      },
      "arquivo",
    ],
  ])("%s: VALIDATION_ERROR no campo, sem chamar o caso de uso", async (_nome, parcial, campo) => {
    const resultado = await anexarAlteracaoContratualAction({ ...INPUT_VALIDO, ...parcial });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.code).toBe("VALIDATION_ERROR");
      expect(Object.keys(resultado.error.fields ?? {})).toContain(campo);
    }
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("repassa o input válido ao caso de uso e devolve sucesso", async () => {
    executeMock.mockResolvedValue(ok(undefined));

    const resultado = await anexarAlteracaoContratualAction(INPUT_VALIDO);

    expect(resultado.ok).toBe(true);
    expect(executeMock).toHaveBeenCalledWith(INPUT_VALIDO);
  });

  it("devolve o erro do caso de uso (ex.: Forbidden)", async () => {
    executeMock.mockResolvedValue(err(new ForbiddenError("Só Admin anexa alteração contratual.")));

    const resultado = await anexarAlteracaoContratualAction(INPUT_VALIDO);

    expect(resultado).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });
});
