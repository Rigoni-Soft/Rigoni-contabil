/**
 * Integração presentation ↔ application: o `main` é substituído por uma composição com
 * casos de uso falsos (testes.md, seção 3), sem tocar Supabase real.
 */
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok } from "@/shared/kernel/result";

import {
  contarAvisosNaoVistosAction,
  listarAvisosCadastroAction,
  marcarAvisoVistoAction,
} from "./avisos-cadastro.actions";

const listarMock = jest.fn();
const contarMock = jest.fn();
const marcarMock = jest.fn();

jest.mock("@/main/clientes.factory", () => ({
  makeListarAvisosCadastro: () => ({ execute: listarMock }),
  makeContarAvisosNaoVistos: () => ({ execute: contarMock }),
  makeMarcarAvisoVisto: () => ({ execute: marcarMock }),
}));

const AVISO_ID = "123e4567-e89b-42d3-a456-426614174000";
const CURSOR = { visto: false, criadoEm: "2026-02-01T10:34:00.123456+00:00", id: AVISO_ID };

beforeEach(() => {
  listarMock.mockReset();
  contarMock.mockReset();
  marcarMock.mockReset();
});

describe("listarAvisosCadastroAction", () => {
  it.each([
    ["cursor sem id", { visto: false, criadoEm: CURSOR.criadoEm }],
    ["cursor com data inválida", { ...CURSOR, criadoEm: "ontem" }],
    ["cursor com id inválido", { ...CURSOR, id: "x" }],
  ])("%s: VALIDATION_ERROR, sem chamar o caso de uso", async (_nome, cursor) => {
    const resultado = await listarAvisosCadastroAction(cursor);

    expect(resultado).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
    expect(listarMock).not.toHaveBeenCalled();
  });

  it("sem cursor, lista a primeira página", async () => {
    const pagina = { itens: [], proximoCursor: null };
    listarMock.mockResolvedValue(ok(pagina));

    const resultado = await listarAvisosCadastroAction(undefined);

    expect(resultado).toEqual({ ok: true, data: pagina });
    expect(listarMock).toHaveBeenCalledWith(null);
  });

  it("repassa o cursor válido", async () => {
    listarMock.mockResolvedValue(ok({ itens: [], proximoCursor: null }));

    await listarAvisosCadastroAction(CURSOR);

    expect(listarMock).toHaveBeenCalledWith(CURSOR);
  });

  it("devolve o erro do caso de uso (sem sessão)", async () => {
    listarMock.mockResolvedValue(err(new ForbiddenError("Faça login.")));

    const resultado = await listarAvisosCadastroAction(undefined);

    expect(resultado).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });
});

describe("contarAvisosNaoVistosAction", () => {
  it("devolve a contagem", async () => {
    contarMock.mockResolvedValue(ok(3));

    expect(await contarAvisosNaoVistosAction()).toEqual({ ok: true, data: 3 });
  });

  it("devolve o erro do caso de uso (sem sessão)", async () => {
    contarMock.mockResolvedValue(err(new ForbiddenError("Faça login.")));

    expect(await contarAvisosNaoVistosAction()).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
  });
});

describe("marcarAvisoVistoAction", () => {
  it("recusa id inválido sem chamar o caso de uso", async () => {
    const resultado = await marcarAvisoVistoAction("não-e-uuid");

    expect(resultado).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
    expect(marcarMock).not.toHaveBeenCalled();
  });

  it("marca o aviso e devolve sucesso", async () => {
    marcarMock.mockResolvedValue(ok(undefined));

    const resultado = await marcarAvisoVistoAction(AVISO_ID);

    expect(resultado.ok).toBe(true);
    expect(marcarMock).toHaveBeenCalledWith(AVISO_ID);
  });

  it("devolve o erro do caso de uso (sem sessão)", async () => {
    marcarMock.mockResolvedValue(err(new ForbiddenError("Faça login.")));

    expect(await marcarAvisoVistoAction(AVISO_ID)).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
  });
});
