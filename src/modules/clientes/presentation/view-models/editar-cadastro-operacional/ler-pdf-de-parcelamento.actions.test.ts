/**
 * Integração presentation ↔ application: o `main` é substituído por uma composição com o caso de
 * uso falso (testes.md, seção 3), sem tocar Supabase nem a API de leitura.
 */
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok } from "@/shared/kernel/result";

import { lerPdfDeParcelamentoAction } from "./ler-pdf-de-parcelamento.actions";

const executeMock = jest.fn();

jest.mock("@/main/clientes.factory", () => ({
  makeLerPdfDeParcelamento: () => ({ execute: executeMock }),
}));

const pdf = (bytes = 8) =>
  new File([new Uint8Array(bytes).fill(7)], "acordo.pdf", { type: "application/pdf" });

describe("lerPdfDeParcelamentoAction (integração)", () => {
  beforeEach(() => executeMock.mockReset());

  it.each([
    ["sem arquivo", undefined],
    ["arquivo de outro tipo", new File(["x"], "a.png", { type: "image/png" })],
    ["arquivo acima de 4 MB", pdf(4 * 1024 * 1024 + 1)],
  ])("%s: VALIDATION_ERROR, sem chamar o caso de uso", async (_nome, arquivo) => {
    const resultado = await lerPdfDeParcelamentoAction({ arquivo });

    expect(resultado).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("entrega os bytes do PDF ao caso de uso e devolve a sugestão", async () => {
    const sugestao = { lido: true, codigo: "A-1", codigoGerado: false, quantidadeDeParcelas: 7 };
    executeMock.mockResolvedValue(ok(sugestao));

    const resultado = await lerPdfDeParcelamentoAction({ arquivo: pdf(3) });

    expect(resultado).toEqual({ ok: true, data: sugestao });
    expect(Array.from(executeMock.mock.calls[0][0].pdf)).toEqual([7, 7, 7]);
  });

  it("devolve o erro do caso de uso (ex.: Forbidden)", async () => {
    executeMock.mockResolvedValue(err(new ForbiddenError("Sem permissão.")));

    expect(await lerPdfDeParcelamentoAction({ arquivo: pdf() })).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
  });
});
