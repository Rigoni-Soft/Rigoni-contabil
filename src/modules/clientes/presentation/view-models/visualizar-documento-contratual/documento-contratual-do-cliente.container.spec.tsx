import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render as renderRtl, screen, waitFor } from "@testing-library/react";

import { DocumentoContratualDoClienteContainer } from "./documento-contratual-do-cliente.container";
import { listarDocumentosContratuaisAction } from "./visualizar-documento-contratual.actions";

jest.mock("./visualizar-documento-contratual.actions", () => ({
  listarDocumentosContratuaisAction: jest.fn(),
  obterLinkDocumentoContratualAction: jest.fn(),
}));

const listar = listarDocumentosContratuaisAction as jest.MockedFunction<
  typeof listarDocumentosContratuaisAction
>;
const CLIENTE = "11111111-1111-1111-1111-111111111111";

function render() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderRtl(
    <QueryClientProvider client={client}>
      <DocumentoContratualDoClienteContainer clienteId={CLIENTE} />
    </QueryClientProvider>,
  );
}

describe("DocumentoContratualDoClienteContainer (#140)", () => {
  beforeEach(() => listar.mockReset());

  it("com alteração, mostra 'Visualizar alteração'", async () => {
    listar.mockResolvedValue({
      ok: true,
      data: [
        { tipo: "alteracao", numero: 2, data: "2025-03-05" },
        { tipo: "contrato", numero: null, data: null },
      ],
    });
    render();

    expect(await screen.findByRole("button", { name: "Visualizar alteração" })).toBeInTheDocument();
  });

  it("só o contrato social: 'Visualizar contrato social'", async () => {
    listar.mockResolvedValue({ ok: true, data: [{ tipo: "contrato", numero: null, data: null }] });
    render();

    expect(
      await screen.findByRole("button", { name: "Visualizar contrato social" }),
    ).toBeInTheDocument();
  });

  it("sem acesso (lista vazia) ou com erro: nenhum botão", async () => {
    listar.mockResolvedValue({ ok: true, data: [] });
    const { unmount } = render();
    await waitFor(() => expect(listar).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    unmount();

    listar.mockResolvedValue({ ok: false, error: { code: "FORBIDDEN", message: "x" } });
    render();
    await waitFor(() => expect(listar).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
