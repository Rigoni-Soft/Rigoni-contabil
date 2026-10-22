import { act, renderHook } from "@testing-library/react";

import { useVisualizarDocumentoContratual } from "./use-visualizar-documento-contratual.hook";
import { obterLinkDocumentoContratualAction } from "./visualizar-documento-contratual.actions";

jest.mock("./visualizar-documento-contratual.actions", () => ({
  obterLinkDocumentoContratualAction: jest.fn(),
}));

const acao = obterLinkDocumentoContratualAction as jest.MockedFunction<
  typeof obterLinkDocumentoContratualAction
>;

const CLIENTE = "11111111-1111-1111-1111-111111111111";
const DOCUMENTOS = [
  { tipo: "alteracao" as const, numero: 3, data: "2025-03-05", arquivo: "3-alteracao.pdf" },
  { tipo: "alteracao" as const, numero: 1, data: "2024-01-10", arquivo: "1-alteracao.pdf" },
  { tipo: "contrato" as const, numero: null, data: null, arquivo: "contrato.pdf" },
];
const FALHA = {
  ok: false as const,
  error: { code: "NOT_FOUND", message: "Documento não encontrado." },
};

let aba: { opener: unknown; location: { href: string }; close: jest.Mock };

beforeEach(() => {
  acao.mockReset();
  aba = { opener: {}, location: { href: "" }, close: jest.fn() };
  window.open = jest.fn(() => aba as unknown as Window);
});

function montar() {
  return renderHook(() => useVisualizarDocumentoContratual(CLIENTE, DOCUMENTOS));
}

describe("useVisualizarDocumentoContratual (#140)", () => {
  it("começa com a alteração de maior nº em destaque", () => {
    expect(montar().result.current.documento).toBe(DOCUMENTOS[0]);
  });

  it("abrir pede o link só de {tipo, número} do mais recente e abre em nova aba", async () => {
    acao.mockResolvedValue({ ok: true, data: { url: "https://storage/assinado" } });
    const { result } = montar();

    await act(() => result.current.abrir());

    expect(acao).toHaveBeenCalledWith({ clienteId: CLIENTE, tipo: "alteracao", numero: 3 });
    expect(aba.location.href).toBe("https://storage/assinado");
    expect(aba.opener).toBeNull();
    expect(result.current.abrindo).toBe(false);
  });

  it("falha ao gerar o link: fecha a aba e expõe o erro", async () => {
    acao.mockResolvedValue(FALHA);
    const { result } = montar();

    await act(() => result.current.abrir());

    expect(result.current.erro).toBe("Documento não encontrado.");
    expect(aba.close).toHaveBeenCalled();
  });

  it("rejeição de transporte fecha a aba, expõe erro e solta o botão", async () => {
    acao.mockRejectedValue(new Error("rede"));
    const { result } = montar();

    await act(() => result.current.abrir());

    expect(result.current.erro).toContain("Não foi possível abrir");
    expect(result.current.abrindo).toBe(false);
    expect(aba.close).toHaveBeenCalled();
  });

  it("pop-up bloqueado: expõe o link gerado e explica", async () => {
    window.open = jest.fn(() => null);
    acao.mockResolvedValue({ ok: true, data: { url: "https://storage/assinado" } });
    const { result } = montar();

    await act(() => result.current.abrir());

    expect(result.current.linkAlternativo).toBe("https://storage/assinado");
    expect(result.current.erro).toContain("bloqueou a nova aba");
  });
});
