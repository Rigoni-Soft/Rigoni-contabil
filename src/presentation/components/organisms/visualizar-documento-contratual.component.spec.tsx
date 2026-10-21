import { fireEvent, render, screen } from "@testing-library/react";

import { VisualizarDocumentoContratual } from "./visualizar-documento-contratual.component";

const OPCOES = [
  { valor: "alteracao-3", rotulo: "Alteração nº 3 - 05/03/2025" },
  { valor: "alteracao-1", rotulo: "Alteração nº 1 - 10/01/2024" },
  { valor: "contrato", rotulo: "Contrato social" },
];

function montar(sobrescrever: Partial<Parameters<typeof VisualizarDocumentoContratual>[0]> = {}) {
  const props = {
    painelId: "docs",
    rotuloDoBotao: "Visualizar alteração",
    opcoes: OPCOES,
    selecionado: OPCOES[0],
    onSelecionar: jest.fn(),
    onAbrir: jest.fn(),
    abrindo: false,
    ...sobrescrever,
  };
  render(<VisualizarDocumentoContratual {...props} />);
  return props;
}

describe("VisualizarDocumentoContratual (#140)", () => {
  it("mostra o rótulo do botão e o documento em destaque", () => {
    montar();

    expect(screen.getByRole("button", { name: "Visualizar alteração" })).toBeInTheDocument();
    expect(screen.getByText("Alteração nº 3 - 05/03/2025", { selector: "p" })).toBeInTheDocument();
  });

  it("rótulo condicional: contrato social quando não há alteração", () => {
    montar({
      rotuloDoBotao: "Visualizar contrato social",
      opcoes: [OPCOES[2]],
      selecionado: OPCOES[2],
    });

    expect(screen.getByRole("button", { name: "Visualizar contrato social" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Escolher documento")).not.toBeInTheDocument();
  });

  it("seletor lista os documentos e troca o destaque", () => {
    const props = montar();

    fireEvent.change(screen.getByLabelText("Escolher documento"), {
      target: { value: "alteracao-1" },
    });

    expect(props.onSelecionar).toHaveBeenCalledWith("alteracao-1");
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("'Abrir' dispara a abertura", () => {
    const props = montar();
    fireEvent.click(
      screen.getByRole("button", { name: "Abrir Alteração nº 3 - 05/03/2025 em nova aba" }),
    );
    expect(props.onAbrir).toHaveBeenCalledTimes(1);
  });

  it("mostra o link alternativo, em nova aba, quando o navegador bloqueou a aba", () => {
    montar({
      erro: "O navegador bloqueou a nova aba.",
      linkAlternativo: "https://storage/assinado",
    });

    const link = screen.getByRole("link", { name: "Abrir Alteração nº 3 - 05/03/2025" });
    expect(link).toHaveAttribute("href", "https://storage/assinado");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("o diálogo é nomeado pelo título e o 'Abrir' recebe o foco inicial", () => {
    montar();

    expect(screen.getByRole("dialog", { hidden: true })).toHaveAccessibleName(
      "Contrato social e alterações",
    );
    expect(screen.getByRole("button", { name: /^Abrir / })).toHaveAttribute("autofocus");
  });

  it("mostra 'Abrindo…' desabilitado e o erro quando houver", () => {
    montar({ abrindo: true, erro: "Não foi possível abrir o documento." });

    expect(screen.getByRole("button", { name: "Abrindo…" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível abrir o documento.");
  });
});
