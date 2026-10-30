/**
 * Integração presentation ↔ application: o `main` é substituído por uma composição com portas OUT
 * falsas (testes.md, seção 3), sem tocar Supabase real.
 */
import { NotFoundError } from "@/shared/errors/not-found.error";
import { err, ok } from "@/shared/kernel/result";

import {
  listarDocumentosContratuaisAction,
  obterLinkDocumentoContratualAction,
} from "./visualizar-documento-contratual.actions";

const listarMock = jest.fn();
const linkMock = jest.fn();

jest.mock("@/main/clientes.factory", () => ({
  makeListarDocumentosContratuaisCliente: () => ({ execute: listarMock }),
  makeObterLinkDocumentoContratual: () => ({ execute: linkMock }),
}));

const CLIENTE_ID = "123e4567-e89b-42d3-a456-426614174000";

describe("listarDocumentosContratuaisAction (integração)", () => {
  beforeEach(() => listarMock.mockReset());

  it("recusa Cliente inválido sem chamar o caso de uso", async () => {
    const resultado = await listarDocumentosContratuaisAction("não-e-uuid");

    expect(resultado.ok).toBe(false);
    expect(listarMock).not.toHaveBeenCalled();
  });

  it("devolve a lista do caso de uso", async () => {
    listarMock.mockResolvedValue(ok([{ tipo: "contrato", numero: null, data: null }]));

    const resultado = await listarDocumentosContratuaisAction(CLIENTE_ID);

    expect(resultado).toEqual({ ok: true, data: [{ tipo: "contrato", numero: null, data: null }] });
    expect(listarMock).toHaveBeenCalledWith(CLIENTE_ID);
  });
});

describe("obterLinkDocumentoContratualAction (integração)", () => {
  beforeEach(() => linkMock.mockReset());

  it.each([
    { clienteId: "x", tipo: "contrato", numero: null },
    { clienteId: CLIENTE_ID, tipo: "alteracao", numero: null },
    { clienteId: CLIENTE_ID, tipo: "alteracao", numero: 0 },
    { clienteId: CLIENTE_ID, tipo: "contrato", numero: 1 },
    { clienteId: CLIENTE_ID, tipo: "outro", numero: 1 },
  ])("recusa input inválido %j sem chamar o caso de uso", async (entrada) => {
    const resultado = await obterLinkDocumentoContratualAction(entrada);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error.code).toBe("VALIDATION_ERROR");
    expect(linkMock).not.toHaveBeenCalled();
  });

  it("devolve o link do caso de uso para {tipo, número} válidos", async () => {
    linkMock.mockResolvedValue(ok({ url: "https://storage/assinado" }));

    const resultado = await obterLinkDocumentoContratualAction({
      clienteId: CLIENTE_ID,
      tipo: "alteracao",
      numero: 2,
    });

    expect(resultado).toEqual({ ok: true, data: { url: "https://storage/assinado" } });
    expect(linkMock).toHaveBeenCalledWith({ clienteId: CLIENTE_ID, tipo: "alteracao", numero: 2 });
  });

  it("devolve o erro do caso de uso (ex.: não encontrado)", async () => {
    linkMock.mockResolvedValue(err(new NotFoundError("Documento não encontrado.")));

    const resultado = await obterLinkDocumentoContratualAction({
      clienteId: CLIENTE_ID,
      tipo: "contrato",
      numero: null,
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error.code).toBe("NOT_FOUND");
  });
});
