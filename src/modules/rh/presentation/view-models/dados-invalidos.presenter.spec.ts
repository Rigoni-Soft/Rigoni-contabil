import { z } from "zod";

import { dadosInvalidos } from "./dados-invalidos.presenter";

describe("dadosInvalidos", () => {
  it("aponta os campos que o schema recusou", () => {
    const parsed = z.object({ nome: z.string().min(1) }).safeParse({ nome: "" });

    expect(parsed.success).toBe(false);
    expect(!parsed.success && dadosInvalidos(parsed.error)).toEqual({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dados inválidos.",
        fields: { nome: expect.any(Array) },
      },
    });
  });
});
