import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";

import { useDocumentosContratuais } from "./documentos-contratuais.queries";
import { listarDocumentosContratuaisAction } from "./visualizar-documento-contratual.actions";

jest.mock("./visualizar-documento-contratual.actions", () => ({
  listarDocumentosContratuaisAction: jest.fn(),
}));

const listar = listarDocumentosContratuaisAction as jest.MockedFunction<
  typeof listarDocumentosContratuaisAction
>;
const CLIENTE = "11111111-1111-1111-1111-111111111111";
const DOCUMENTOS = [{ tipo: "contrato" as const, numero: null, data: null }];

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useDocumentosContratuais (#140)", () => {
  beforeEach(() => listar.mockReset());

  it("sem carga inicial, lê a lista pela Server Action", async () => {
    listar.mockResolvedValue({ ok: true, data: DOCUMENTOS });

    const { result } = renderHook(() => useDocumentosContratuais(CLIENTE), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual(DOCUMENTOS));
    expect(listar).toHaveBeenCalledWith(CLIENTE);
  });

  it("com a carga do servidor, não dispara action no mount", () => {
    const { result } = renderHook(() => useDocumentosContratuais(CLIENTE, DOCUMENTOS), {
      wrapper,
    });

    expect(result.current.data).toEqual(DOCUMENTOS);
    expect(listar).not.toHaveBeenCalled();
  });

  it("ActionResult com falha vira erro da query", async () => {
    listar.mockResolvedValue({ ok: false, error: { code: "X", message: "falhou" } });

    const { result } = renderHook(() => useDocumentosContratuais(CLIENTE), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
