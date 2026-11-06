/**
 * Integração presentation ↔ application: o `main` é substituído por uma composição com casos de
 * uso falsos (testes.md, seção 3), sem tocar Supabase.
 */
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok } from "@/shared/kernel/result";

import {
  atribuirResponsavelAction,
  listarResponsaveisElegiveisAction,
} from "./atribuir-responsavel.actions";

const atribuirMock = jest.fn();
const listarMock = jest.fn();

jest.mock("@/main/clientes.factory", () => ({
  makeAtribuirResponsavelCliente: async () => ({ execute: atribuirMock }),
  makeListarResponsaveisElegiveis: async () => ({ execute: listarMock }),
}));

const CLIENTE_ID = "c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1";
// id do seed: não é v4, só passa em z.guid()
const RESPONSAVEL_ID = "22222222-2222-2222-2222-222222222222";

describe("atribuir-responsavel.actions (integração)", () => {
  beforeEach(() => {
    atribuirMock.mockReset();
    listarMock.mockReset();
  });

  describe("atribuirResponsavelAction", () => {
    it.each([
      ["cliente que não é um id", { clienteId: "abc", responsavelId: null }],
      ["responsável que não é um id", { clienteId: CLIENTE_ID, responsavelId: "abc" }],
      ["responsável ausente", { clienteId: CLIENTE_ID }],
      ["sem corpo", undefined],
    ])("%s: VALIDATION_ERROR, sem chamar o caso de uso", async (_nome, input) => {
      expect(await atribuirResponsavelAction(input)).toMatchObject({
        ok: false,
        error: { code: "VALIDATION_ERROR" },
      });
      expect(atribuirMock).not.toHaveBeenCalled();
    });

    it("aceita id do seed e entrega ao caso de uso", async () => {
      atribuirMock.mockResolvedValue(ok(undefined));
      const input = { clienteId: CLIENTE_ID, responsavelId: RESPONSAVEL_ID };

      expect(await atribuirResponsavelAction(input)).toEqual({ ok: true, data: undefined });
      expect(atribuirMock).toHaveBeenCalledWith(input);
    });

    it("aceita responsável nulo (remover atribuição)", async () => {
      atribuirMock.mockResolvedValue(ok(undefined));

      await atribuirResponsavelAction({ clienteId: CLIENTE_ID, responsavelId: null });

      expect(atribuirMock).toHaveBeenCalledWith({ clienteId: CLIENTE_ID, responsavelId: null });
    });

    it("devolve o erro do caso de uso (Forbidden)", async () => {
      atribuirMock.mockResolvedValue(err(new ForbiddenError("Sem permissão.")));

      expect(
        await atribuirResponsavelAction({ clienteId: CLIENTE_ID, responsavelId: null }),
      ).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    });
  });

  describe("listarResponsaveisElegiveisAction", () => {
    it("devolve as opções do caso de uso", async () => {
      const opcoes = [{ id: RESPONSAVEL_ID, nome: "Ana" }];
      listarMock.mockResolvedValue(ok(opcoes));

      expect(await listarResponsaveisElegiveisAction()).toEqual({ ok: true, data: opcoes });
    });

    it("devolve o erro do caso de uso (Forbidden)", async () => {
      listarMock.mockResolvedValue(err(new ForbiddenError("Sem permissão.")));

      expect(await listarResponsaveisElegiveisAction()).toMatchObject({
        ok: false,
        error: { code: "FORBIDDEN" },
      });
    });
  });
});
