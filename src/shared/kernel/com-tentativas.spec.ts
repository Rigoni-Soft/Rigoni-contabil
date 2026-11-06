import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";

import { comTentativas } from "./com-tentativas";
import { err, ok } from "./result";

describe("comTentativas", () => {
  it("repete falha do serviço externo até dar certo", async () => {
    const operacao = jest
      .fn()
      .mockResolvedValueOnce(err(new ServicoExternoError("503")))
      .mockResolvedValueOnce(ok("feito"));

    const resultado = await comTentativas(operacao, 3, 0);

    expect(resultado).toEqual({ ok: true, value: "feito" });
    expect(operacao).toHaveBeenCalledTimes(2);
  });

  it("desiste depois do número de tentativas e devolve o último erro", async () => {
    const operacao = jest.fn().mockResolvedValue(err(new ServicoExternoError("503")));

    const resultado = await comTentativas(operacao, 3, 0);

    expect(resultado.ok).toBe(false);
    expect(operacao).toHaveBeenCalledTimes(3);
  });

  it("não repete o que não é transitório", async () => {
    const operacao = jest.fn().mockResolvedValue(err(new ForbiddenError("sem autorização")));

    await comTentativas(operacao, 3, 0);

    expect(operacao).toHaveBeenCalledTimes(1);
  });
});
