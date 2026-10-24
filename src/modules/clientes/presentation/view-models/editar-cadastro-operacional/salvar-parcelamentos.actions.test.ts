/**
 * Integração presentation ↔ application: o `main` é substituído por uma composição com o caso de
 * uso falso (testes.md, seção 3), sem tocar Supabase real.
 */
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok } from "@/shared/kernel/result";

import { salvarParcelamentosAction } from "./salvar-parcelamentos.actions";

const executeMock = jest.fn();

jest.mock("@/main/clientes.factory", () => ({
  makeSalvarParcelamentosCliente: () => ({ execute: executeMock }),
}));

const pdf = (bytes = 8) =>
  new File([new Uint8Array(bytes)], "acordo.pdf", { type: "application/pdf" });

const INPUT_VALIDO = {
  clienteId: "c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1",
  parcelamentos: [
    { codigo: "PARC-1", parcelasRestantes: 12, interno: false, arquivo: pdf() },
    {
      id: "11111111-1111-4111-8111-111111111111",
      codigo: "PARC-2",
      parcelasRestantes: 3,
      interno: true,
    },
  ],
};

describe("salvarParcelamentosAction (integração)", () => {
  beforeEach(() => executeMock.mockReset());

  it.each([
    ["parcelas restantes negativa", { parcelasRestantes: -1 }],
    ["parcelas restantes fracionada", { parcelasRestantes: 1.5 }],
    ["arquivo de outro tipo", { arquivo: new File(["x"], "a.png", { type: "image/png" }) }],
    ["arquivo acima de 4 MB", { arquivo: pdf(4 * 1024 * 1024 + 1) }],
  ])("%s: VALIDATION_ERROR, sem chamar o caso de uso", async (_nome, parcial) => {
    const resultado = await salvarParcelamentosAction({
      ...INPUT_VALIDO,
      parcelamentos: [{ ...INPUT_VALIDO.parcelamentos[0], ...parcial }],
    });

    expect(resultado).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("repassa o input válido ao caso de uso e devolve sucesso", async () => {
    executeMock.mockResolvedValue(ok(undefined));

    const resultado = await salvarParcelamentosAction(INPUT_VALIDO);

    expect(resultado.ok).toBe(true);
    expect(executeMock).toHaveBeenCalledWith(INPUT_VALIDO);
  });

  it("código em branco é válido (o sistema gera) e chega ao caso de uso aparado", async () => {
    executeMock.mockResolvedValue(ok(undefined));

    const resultado = await salvarParcelamentosAction({
      ...INPUT_VALIDO,
      parcelamentos: [{ ...INPUT_VALIDO.parcelamentos[0], codigo: " " }],
    });

    expect(resultado.ok).toBe(true);
    expect(executeMock).toHaveBeenCalledWith(
      expect.objectContaining({ parcelamentos: [expect.objectContaining({ codigo: "" })] }),
    );
  });

  it("devolve o erro do caso de uso (ex.: Forbidden)", async () => {
    executeMock.mockResolvedValue(err(new ForbiddenError("Sem permissão.")));

    const resultado = await salvarParcelamentosAction(INPUT_VALIDO);

    expect(resultado).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });
});
