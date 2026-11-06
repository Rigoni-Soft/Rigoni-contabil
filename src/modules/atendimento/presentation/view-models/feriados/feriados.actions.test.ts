/**
 * Integração presentation ↔ application: o `main` é substituído por uma composição com casos de
 * uso falsos (testes.md, seção 3), sem tocar Supabase.
 */
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok } from "@/shared/kernel/result";

import { cadastrarFeriadoAction, removerFeriadoAction } from "./feriados.actions";

const cadastrarMock = jest.fn();
const removerMock = jest.fn();

jest.mock("@/main/atendimento.factory", () => ({
  makeCadastrarFeriado: async () => ({ execute: cadastrarMock }),
  makeRemoverFeriado: async () => ({ execute: removerMock }),
}));

describe("feriados.actions (integração)", () => {
  beforeEach(() => {
    cadastrarMock.mockReset();
    removerMock.mockReset();
  });

  describe("cadastrarFeriadoAction", () => {
    it.each([
      ["data inválida", { data: "31/12/2026", descricao: "Natal" }],
      ["descrição vazia", { data: "2026-12-25", descricao: "   " }],
      ["descrição acima de 200", { data: "2026-12-25", descricao: "x".repeat(201) }],
      ["sem corpo", undefined],
    ])("%s: VALIDATION_ERROR, sem chamar o caso de uso", async (_nome, input) => {
      expect(await cadastrarFeriadoAction(input)).toMatchObject({
        ok: false,
        error: { code: "VALIDATION_ERROR" },
      });
      expect(cadastrarMock).not.toHaveBeenCalled();
    });

    it("entrega os dados validados ao caso de uso", async () => {
      cadastrarMock.mockResolvedValue(ok(undefined));

      expect(await cadastrarFeriadoAction({ data: "2026-12-25", descricao: " Natal " })).toEqual({
        ok: true,
        data: undefined,
      });
      expect(cadastrarMock).toHaveBeenCalledWith({ data: "2026-12-25", descricao: "Natal" });
    });

    it("devolve o erro do caso de uso (Forbidden)", async () => {
      cadastrarMock.mockResolvedValue(err(new ForbiddenError("Sem permissão.")));

      expect(
        await cadastrarFeriadoAction({ data: "2026-12-25", descricao: "Natal" }),
      ).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    });
  });

  describe("removerFeriadoAction", () => {
    it.each([["25/12/2026"], [undefined], [20261225]])(
      "data %p: VALIDATION_ERROR, sem chamar o caso de uso",
      async (data) => {
        expect(await removerFeriadoAction(data)).toMatchObject({
          ok: false,
          error: { code: "VALIDATION_ERROR" },
        });
        expect(removerMock).not.toHaveBeenCalled();
      },
    );

    it("entrega a data ao caso de uso", async () => {
      removerMock.mockResolvedValue(ok(undefined));

      expect(await removerFeriadoAction("2026-12-25")).toEqual({ ok: true, data: undefined });
      expect(removerMock).toHaveBeenCalledWith({ data: "2026-12-25" });
    });

    it("devolve o erro do caso de uso (Forbidden)", async () => {
      removerMock.mockResolvedValue(err(new ForbiddenError("Sem permissão.")));

      expect(await removerFeriadoAction("2026-12-25")).toMatchObject({
        ok: false,
        error: { code: "FORBIDDEN" },
      });
    });
  });
});
