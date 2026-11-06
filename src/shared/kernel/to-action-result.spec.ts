import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok } from "@/shared/kernel/result";

import { toActionResult } from "./to-action-result";

describe("toActionResult", () => {
  it("converte ok mantendo o valor", () => {
    expect(toActionResult(ok({ id: "1" }))).toEqual({ ok: true, data: { id: "1" } });
  });

  it("preserva fields quando o erro é ValidationError", () => {
    const erro = new ValidationError("Dados de cliente inválidos", { cnpj: ["CNPJ inválido"] });

    const resultado = toActionResult(err(erro));

    expect(resultado).toEqual({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dados de cliente inválidos",
        fields: { cnpj: ["CNPJ inválido"] },
      },
    });
  });

  it("não inclui fields quando o erro não é ValidationError", () => {
    const resultado = toActionResult(err(new ForbiddenError("Só Admin.")));

    expect(resultado).toEqual({
      ok: false,
      error: { code: "FORBIDDEN", message: "Só Admin." },
    });
  });
});
