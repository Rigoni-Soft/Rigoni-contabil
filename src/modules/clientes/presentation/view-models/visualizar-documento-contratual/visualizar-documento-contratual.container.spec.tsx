import { fireEvent, render, screen } from "@testing-library/react";

import type { DocumentoContratualVisivelDto } from "@/modules/clientes/application/ports/in/documentos-contratuais-cliente.provider";

import { useVisualizarDocumentoContratual } from "./use-visualizar-documento-contratual.hook";
import { VisualizarDocumentoContratualContainer } from "./visualizar-documento-contratual.container";

jest.mock("./use-visualizar-documento-contratual.hook", () => ({
  useVisualizarDocumentoContratual: jest.fn(),
}));

const hook = useVisualizarDocumentoContratual as jest.MockedFunction<
  typeof useVisualizarDocumentoContratual
>;

const CLIENTE = "11111111-1111-1111-1111-111111111111";
const ALTERACAO = {
  tipo: "alteracao" as const,
  numero: 3,
  data: "2025-03-05",
  arquivo: "3-alteracao.pdf",
};
const ALTERACAO_ANTIGA = {
  tipo: "alteracao" as const,
  numero: 1,
  data: "2024-01-10",
  arquivo: "1-alteracao.pdf",
};
const CONTRATO = { tipo: "contrato" as const, numero: null, data: null, arquivo: "contrato.pdf" };

function hookDevolvendo(selecionado: DocumentoContratualVisivelDto = ALTERACAO, sobrescrever = {}) {
  const retorno = {
    documento: selecionado,
    abrir: jest.fn().mockResolvedValue(undefined),
    abrindo: false,
    erro: undefined,
    linkAlternativo: undefined,
    ...sobrescrever,
  };
  hook.mockReturnValue(retorno);
  return retorno;
}

describe("VisualizarDocumentoContratualContainer (#140)", () => {
  it("entrega à View o destaque do hook e o botão 'Abrir em nova aba'", () => {
    hookDevolvendo();

    render(
      <VisualizarDocumentoContratualContainer
        clienteId={CLIENTE}
        documentos={[ALTERACAO, ALTERACAO_ANTIGA, CONTRATO]}
      />,
    );

    expect(screen.getByRole("button", { name: /^Abrir / })).toHaveTextContent("Abrir em nova aba");
    expect(screen.getByText("Alteração nº 3 - 05/03/2025", { selector: "p" })).toBeInTheDocument();
  });

  it("sem alteração, o destaque é o contrato social", () => {
    hookDevolvendo(CONTRATO);

    render(<VisualizarDocumentoContratualContainer clienteId={CLIENTE} documentos={[CONTRATO]} />);

    expect(screen.getByText("Contrato social", { selector: "p" })).toBeInTheDocument();
  });

  it("'Abrir' chama abrir() do hook, sem seletor de documento", () => {
    const { abrir } = hookDevolvendo();
    render(
      <VisualizarDocumentoContratualContainer
        clienteId={CLIENTE}
        documentos={[ALTERACAO, ALTERACAO_ANTIGA, CONTRATO]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^Abrir / }));

    expect(abrir).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("Escolher documento")).not.toBeInTheDocument();
  });

  it("repassa erro e link alternativo do hook à View", () => {
    hookDevolvendo(ALTERACAO, {
      erro: "O navegador bloqueou a nova aba.",
      linkAlternativo: "https://x",
    });

    render(<VisualizarDocumentoContratualContainer clienteId={CLIENTE} documentos={[ALTERACAO]} />);

    expect(screen.getByRole("alert")).toHaveTextContent("bloqueou a nova aba");
    expect(screen.getByRole("link", { name: /^Abrir / })).toHaveAttribute("href", "https://x");
  });
});
