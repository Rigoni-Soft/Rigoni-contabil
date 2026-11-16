/**
 * Integração presentation ↔ application da ação de baixar o PDF do cartão: o `main` é substituído por uma
 * composição com o caso de uso falso (testes.md, seção 3), sem tocar Supabase.
 */
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok } from "@/shared/kernel/result";

import { baixarPdfDoCartaoAction } from "./folha-de-ponto.actions";

const ID = "11111111-1111-4111-8111-111111111111";
const ENTRADA = { clienteId: ID, empregadoId: ID, competencia: "2026-11" };

const caso = jest.fn();

jest.mock("@/main/rh.factory", () => ({
  makeBaixarPdfDoCartao: async () => ({ execute: caso }),
}));

describe("baixarPdfDoCartaoAction (integração)", () => {
  beforeEach(() => caso.mockReset());

  it("entrega os dados ao caso de uso e devolve o arquivo em base64", async () => {
    caso.mockResolvedValue(
      ok({ nomeDoArquivo: "cartao.pdf", bytes: new Uint8Array([37, 80, 68, 70]) }),
    );

    const r = await baixarPdfDoCartaoAction(ENTRADA);

    expect(caso).toHaveBeenCalledWith(ENTRADA);
    expect(r).toEqual({
      ok: true,
      data: { nomeDoArquivo: "cartao.pdf", base64: Buffer.from("%PDF").toString("base64") },
    });
  });

  it("repassa a recusa do caso de uso", async () => {
    caso.mockResolvedValue(err(new ForbiddenError("Sem acesso à Folha de ponto do RH.")));

    expect(await baixarPdfDoCartaoAction(ENTRADA)).toEqual({
      ok: false,
      error: { code: "FORBIDDEN", message: "Sem acesso à Folha de ponto do RH." },
    });
  });

  it.each([
    [{ ...ENTRADA, competencia: "novembro" }],
    [{ ...ENTRADA, empregadoId: "x" }],
    [{ empregadoId: ID, competencia: "2026-11" }],
  ])("dado inválido é recusado sem chamar o caso de uso", async (entrada) => {
    const r = await baixarPdfDoCartaoAction(entrada);

    expect(r.ok).toBe(false);
    expect(caso).not.toHaveBeenCalled();
  });
});
