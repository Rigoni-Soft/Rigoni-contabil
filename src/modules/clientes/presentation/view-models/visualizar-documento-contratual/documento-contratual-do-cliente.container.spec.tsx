import { fireEvent, render, screen } from "@testing-library/react";

import { DocumentoContratualDoClienteContainer } from "./documento-contratual-do-cliente.container";
import { useDocumentosContratuais } from "./documentos-contratuais.queries";

jest.mock("./documentos-contratuais.queries", () => ({ useDocumentosContratuais: jest.fn() }));
jest.mock("./visualizar-documento-contratual.container", () => ({
  VisualizarDocumentoContratualContainer: ({ documentos }: { documentos: unknown[] }) => (
    <button type="button">{`botão com ${documentos.length} documento(s)`}</button>
  ),
}));

const query = useDocumentosContratuais as jest.MockedFunction<typeof useDocumentosContratuais>;
const CLIENTE = "11111111-1111-1111-1111-111111111111";
const refetch = jest.fn();

function estado(parcial: { data?: unknown; isPending?: boolean; isError?: boolean }) {
  query.mockReturnValue({
    data: undefined,
    isPending: false,
    isError: false,
    refetch,
    ...parcial,
  } as unknown as ReturnType<typeof useDocumentosContratuais>);
}

describe("DocumentoContratualDoClienteContainer (#140)", () => {
  beforeEach(() => refetch.mockReset());

  it("com documentos, entrega a lista ao container do botão", () => {
    estado({ data: [{ tipo: "contrato", numero: null, data: null, arquivo: "contrato.pdf" }] });

    render(<DocumentoContratualDoClienteContainer clienteId={CLIENTE} />);

    expect(screen.getByRole("button", { name: "botão com 1 documento(s)" })).toBeInTheDocument();
  });

  it("repassa a carga inicial do servidor à query", () => {
    const iniciais = [
      { tipo: "contrato" as const, numero: null, data: null, arquivo: "contrato.pdf" },
    ];
    estado({ data: iniciais });

    render(
      <DocumentoContratualDoClienteContainer clienteId={CLIENTE} documentosIniciais={iniciais} />,
    );

    expect(query).toHaveBeenCalledWith(CLIENTE, iniciais, undefined);
  });

  it("enquanto carrega, reserva o lugar do cartão sem mostrar nada acionável", () => {
    estado({ isPending: true });
    const { container } = render(<DocumentoContratualDoClienteContainer clienteId={CLIENTE} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"]')).toHaveClass("min-h-20");
  });

  it("sem acesso (lista vazia): nenhum botão e nenhum aviso", () => {
    estado({ data: [] });

    render(<DocumentoContratualDoClienteContainer clienteId={CLIENTE} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("falha ao consultar: avisa e 'Tentar novamente' chama refetch()", () => {
    estado({ isError: true });
    render(<DocumentoContratualDoClienteContainer clienteId={CLIENTE} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível carregar");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
