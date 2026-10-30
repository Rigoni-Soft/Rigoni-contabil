/**
 * Integração presentation ↔ application: o `main` é substituído por uma composição com casos de
 * uso falsos (testes.md, seção 3), sem tocar Supabase.
 */
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok } from "@/shared/kernel/result";

import {
  anexarGuiaParcelaPgfnAction,
  confirmarGuiaParcelaPgfnAction,
  listarGuiasParcelaPgfnAction,
  obterLinkGuiaParcelaPgfnAction,
  removerGuiaParcelaPgfnAction,
  trocarGuiaParcelaPgfnAction,
} from "./anexar-guia-parcela-pgfn.actions";

const mocks = {
  anexar: jest.fn(),
  confirmar: jest.fn(),
  listar: jest.fn(),
  obterLink: jest.fn(),
  remover: jest.fn(),
  trocar: jest.fn(),
};

jest.mock("@/main/clientes.factory", () => ({
  makeAnexarGuiaParcelaPgfn: async () => ({ execute: mocks.anexar }),
  makeConfirmarGuiaParcelaPgfn: async () => ({ execute: mocks.confirmar }),
  makeListarGuiasParcelaPgfn: async () => ({ execute: mocks.listar }),
  makeObterLinkGuiaParcelaPgfn: async () => ({ execute: mocks.obterLink }),
  makeRemoverGuiaParcelaPgfn: async () => ({ execute: mocks.remover }),
  makeTrocarGuiaParcelaPgfn: async () => ({ execute: mocks.trocar }),
}));

const PARCELAMENTO_ID = "c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1";
const CHAVE = { parcelamentoId: PARCELAMENTO_ID, competencia: "202610" };

const pdf = (bytes = 8) =>
  new File([new Uint8Array(bytes).fill(7)], "guia.pdf", { type: "application/pdf" });

const invalido = { ok: false, error: { code: "VALIDATION_ERROR" } };

describe("anexar-guia-parcela-pgfn.actions (integração)", () => {
  beforeEach(() => Object.values(mocks).forEach((m) => m.mockReset()));

  describe("anexarGuiaParcelaPgfnAction", () => {
    it.each([
      ["sem arquivo", { arquivo: undefined }],
      ["arquivo de outro tipo", { arquivo: new File(["x"], "a.png", { type: "image/png" }) }],
      ["arquivo acima de 4 MB", { arquivo: pdf(4 * 1024 * 1024 + 1) }],
      ["parcelamento que não é um id", { parcelamentoId: "abc" }],
      ["competência fora do formato", { competencia: "2026-13" }],
    ])("%s: VALIDATION_ERROR, sem chamar o caso de uso", async (_nome, parcial) => {
      const resultado = await anexarGuiaParcelaPgfnAction({
        parcelamentoId: PARCELAMENTO_ID,
        arquivo: pdf(),
        ...parcial,
      });

      expect(resultado).toMatchObject(invalido);
      expect(mocks.anexar).not.toHaveBeenCalled();
    });

    it("entrega os bytes do PDF ao caso de uso e devolve a guia", async () => {
      const guia = { competencia: "202610" };
      mocks.anexar.mockResolvedValue(ok(guia));

      const resultado = await anexarGuiaParcelaPgfnAction({
        parcelamentoId: PARCELAMENTO_ID,
        competencia: "  ",
        arquivo: pdf(3),
      });

      expect(resultado).toEqual({ ok: true, data: guia });
      const entrada = mocks.anexar.mock.calls[0][0];
      expect(entrada.parcelamentoId).toBe(PARCELAMENTO_ID);
      expect(entrada.competencia).toBeUndefined();
      expect(Array.from(entrada.pdf)).toEqual([7, 7, 7]);
    });

    it("devolve o erro do caso de uso (Forbidden)", async () => {
      mocks.anexar.mockResolvedValue(err(new ForbiddenError("Sem permissão.")));

      expect(
        await anexarGuiaParcelaPgfnAction({ parcelamentoId: PARCELAMENTO_ID, arquivo: pdf() }),
      ).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    });
  });

  describe("trocarGuiaParcelaPgfnAction", () => {
    it("PDF inválido: VALIDATION_ERROR, sem chamar o caso de uso", async () => {
      expect(await trocarGuiaParcelaPgfnAction({ ...CHAVE, arquivo: undefined })).toMatchObject(
        invalido,
      );
      expect(mocks.trocar).not.toHaveBeenCalled();
    });

    it("entrega a chave e os bytes ao caso de uso", async () => {
      mocks.trocar.mockResolvedValue(ok({ competencia: "202610" }));

      await trocarGuiaParcelaPgfnAction({ ...CHAVE, arquivo: pdf(2) });

      const entrada = mocks.trocar.mock.calls[0][0];
      expect(entrada).toMatchObject(CHAVE);
      expect(Array.from(entrada.pdf)).toEqual([7, 7]);
    });
  });

  describe("confirmarGuiaParcelaPgfnAction", () => {
    it("sem versão: VALIDATION_ERROR, sem chamar o caso de uso", async () => {
      expect(await confirmarGuiaParcelaPgfnAction({ ...CHAVE, versao: "" })).toMatchObject(
        invalido,
      );
      expect(mocks.confirmar).not.toHaveBeenCalled();
    });

    it("entrega a chave e a versão ao caso de uso", async () => {
      mocks.confirmar.mockResolvedValue(ok(undefined));

      expect(await confirmarGuiaParcelaPgfnAction({ ...CHAVE, versao: "v1" })).toEqual({
        ok: true,
        data: undefined,
      });
      expect(mocks.confirmar).toHaveBeenCalledWith({ ...CHAVE, versao: "v1" });
    });
  });

  describe("listarGuiasParcelaPgfnAction", () => {
    it("parcelamento inválido: VALIDATION_ERROR, sem chamar o caso de uso", async () => {
      expect(await listarGuiasParcelaPgfnAction({ parcelamentoId: "abc" })).toMatchObject(invalido);
      expect(mocks.listar).not.toHaveBeenCalled();
    });

    it("entrega o id do parcelamento e devolve as guias", async () => {
      mocks.listar.mockResolvedValue(ok([]));

      expect(await listarGuiasParcelaPgfnAction({ parcelamentoId: PARCELAMENTO_ID })).toEqual({
        ok: true,
        data: [],
      });
      expect(mocks.listar).toHaveBeenCalledWith(PARCELAMENTO_ID);
    });
  });

  describe.each([
    ["removerGuiaParcelaPgfnAction", removerGuiaParcelaPgfnAction, mocks.remover],
    ["obterLinkGuiaParcelaPgfnAction", obterLinkGuiaParcelaPgfnAction, mocks.obterLink],
  ])("%s", (_nome, action, mock) => {
    it("competência inválida: VALIDATION_ERROR, sem chamar o caso de uso", async () => {
      expect(await action({ ...CHAVE, competencia: "2026" })).toMatchObject(invalido);
      expect(mock).not.toHaveBeenCalled();
    });

    it("entrega a chave ao caso de uso e devolve o resultado", async () => {
      mock.mockResolvedValue(ok({ url: "https://x" }));

      expect(await action(CHAVE)).toEqual({ ok: true, data: { url: "https://x" } });
      expect(mock).toHaveBeenCalledWith(CHAVE);
    });

    it("devolve o erro do caso de uso (Forbidden)", async () => {
      mock.mockResolvedValue(err(new ForbiddenError("Sem permissão.")));

      expect(await action(CHAVE)).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    });
  });
});
