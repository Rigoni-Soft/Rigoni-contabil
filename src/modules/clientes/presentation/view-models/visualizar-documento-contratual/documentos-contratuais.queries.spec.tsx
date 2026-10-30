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
const DOCUMENTOS = [
  { tipo: "contrato" as const, numero: null, data: null, arquivo: "contrato.pdf" },
];

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

  describe("alteracaoEmFoco (R171-02)", () => {
    const ALT = (numero: number) => ({
      tipo: "alteracao" as const,
      numero,
      data: "2026-10-22",
      arquivo: `alt-${numero}.pdf`,
    });

    function comCache(documentosEmCache: ReturnType<typeof ALT>[]) {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      client.setQueryData(["clientes", "documentos-contratuais", CLIENTE], documentosEmCache);
      return function WrapperComCache({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
      };
    }

    it("cache recente sem a alteração do aviso: relê a lista e só então libera a tela", async () => {
      listar.mockResolvedValue({ ok: true, data: [ALT(3), ALT(2)] });

      const { result } = renderHook(() => useDocumentosContratuais(CLIENTE, [ALT(3), ALT(2)], 3), {
        wrapper: comCache([ALT(2)]),
      });

      expect(result.current.confirmando).toBe(true);
      await waitFor(() => expect(result.current.confirmando).toBe(false));
      expect(listar).toHaveBeenCalledTimes(1);
      expect(result.current.data?.map((d) => d.numero)).toEqual([3, 2]);
    });

    it("nº realmente inexistente: relê uma vez, confirma a ausência e não relê de novo", async () => {
      listar.mockResolvedValue({ ok: true, data: [ALT(2)] });

      const { result, rerender } = renderHook(
        () => useDocumentosContratuais(CLIENTE, [ALT(2)], 99),
        { wrapper: comCache([ALT(2)]) },
      );

      await waitFor(() => expect(result.current.confirmando).toBe(false));
      rerender();
      expect(listar).toHaveBeenCalledTimes(1);
    });

    it("alteração já presente ou sem aviso: não relê", () => {
      const comAviso = renderHook(() => useDocumentosContratuais(CLIENTE, [ALT(2)], 2), {
        wrapper: comCache([ALT(2)]),
      });
      const semAviso = renderHook(() => useDocumentosContratuais(CLIENTE, [ALT(2)]), {
        wrapper: comCache([ALT(2)]),
      });

      expect(comAviso.result.current.confirmando).toBe(false);
      expect(semAviso.result.current.confirmando).toBe(false);
      expect(listar).not.toHaveBeenCalled();
    });
  });

  it("ActionResult com falha vira erro da query", async () => {
    listar.mockResolvedValue({ ok: false, error: { code: "X", message: "falhou" } });

    const { result } = renderHook(() => useDocumentosContratuais(CLIENTE), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
