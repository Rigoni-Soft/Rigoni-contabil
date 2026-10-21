import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { obterLinkDocumentoContratualAction } from "./visualizar-documento-contratual.actions";
import { VisualizarDocumentoContratualContainer } from "./visualizar-documento-contratual.container";

jest.mock("./visualizar-documento-contratual.actions", () => ({
  obterLinkDocumentoContratualAction: jest.fn(),
}));

const acao = obterLinkDocumentoContratualAction as jest.MockedFunction<
  typeof obterLinkDocumentoContratualAction
>;

const CLIENTE = "11111111-1111-1111-1111-111111111111";
const DOCUMENTOS = [
  { tipo: "alteracao" as const, numero: 3, data: "2025-03-05" },
  { tipo: "alteracao" as const, numero: 1, data: "2024-01-10" },
  { tipo: "contrato" as const, numero: null, data: null },
];

let aba: { opener: unknown; location: { href: string }; close: jest.Mock };

beforeEach(() => {
  acao.mockReset();
  aba = { opener: {}, location: { href: "" }, close: jest.fn() };
  window.open = jest.fn(() => aba as unknown as Window);
});

describe("VisualizarDocumentoContratualContainer (#140)", () => {
  it("abre em destaque a alteração de maior nº", () => {
    render(<VisualizarDocumentoContratualContainer clienteId={CLIENTE} documentos={DOCUMENTOS} />);

    expect(screen.getByRole("button", { name: "Visualizar alteração" })).toBeInTheDocument();
    expect(screen.getByText("Alteração nº 3 - 05/03/2025", { selector: "p" })).toBeInTheDocument();
  });

  it("sem alteração, o botão é 'Visualizar contrato social'", () => {
    render(
      <VisualizarDocumentoContratualContainer clienteId={CLIENTE} documentos={[DOCUMENTOS[2]]} />,
    );

    expect(screen.getByRole("button", { name: "Visualizar contrato social" })).toBeInTheDocument();
  });

  it("'Abrir' pede o link só de {tipo, número} e abre em nova aba", async () => {
    acao.mockResolvedValue({ ok: true, data: { url: "https://storage/assinado" } });
    render(<VisualizarDocumentoContratualContainer clienteId={CLIENTE} documentos={DOCUMENTOS} />);
    fireEvent.change(screen.getByLabelText("Outros documentos"), {
      target: { value: "alteracao-1" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));

    await waitFor(() => expect(aba.location.href).toBe("https://storage/assinado"));
    expect(acao).toHaveBeenCalledWith({ clienteId: CLIENTE, tipo: "alteracao", numero: 1 });
    expect(aba.opener).toBeNull();
  });

  it("falha ao gerar o link: fecha a aba e mostra o erro", async () => {
    acao.mockResolvedValue({
      ok: false,
      error: { code: "NOT_FOUND", message: "Documento não encontrado." },
    });
    render(<VisualizarDocumentoContratualContainer clienteId={CLIENTE} documentos={DOCUMENTOS} />);

    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Documento não encontrado.");
    expect(aba.close).toHaveBeenCalled();
  });

  it("rejeição de transporte também fecha a aba e mostra erro, sem prender o botão", async () => {
    acao.mockRejectedValue(new Error("rede"));
    render(<VisualizarDocumentoContratualContainer clienteId={CLIENTE} documentos={DOCUMENTOS} />);

    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível abrir");
    expect(screen.getByRole("button", { name: "Abrir" })).toBeEnabled();
    expect(aba.close).toHaveBeenCalled();
  });
});
