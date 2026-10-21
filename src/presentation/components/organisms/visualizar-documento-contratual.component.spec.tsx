import { fireEvent, render, screen } from "@testing-library/react";

import { VisualizarDocumentoContratual } from "./visualizar-documento-contratual.component";

function montar(sobrescrever: Partial<Parameters<typeof VisualizarDocumentoContratual>[0]> = {}) {
  const props = {
    rotulo: "Alteração nº 3 - 05/03/2025",
    onAbrir: jest.fn(),
    abrindo: false,
    ...sobrescrever,
  };
  render(<VisualizarDocumentoContratual {...props} />);
  return props;
}

describe("VisualizarDocumentoContratual (#140)", () => {
  it("mostra o documento em destaque e o botão que abre em nova aba, sem diálogo", () => {
    montar();

    expect(screen.getByText("Alteração nº 3 - 05/03/2025", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Abrir / })).toHaveTextContent("Abrir em nova aba");
    expect(screen.queryByRole("dialog", { hidden: true })).not.toBeInTheDocument();
  });

  it("só o contrato social: mostra o contrato", () => {
    montar({ rotulo: "Contrato social" });

    expect(screen.getByText("Contrato social", { selector: "p" })).toBeInTheDocument();
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

  it("mostra 'Abrindo…' desabilitado e o erro quando houver", () => {
    montar({ abrindo: true, erro: "Não foi possível abrir o documento." });

    expect(screen.getByRole("button", { name: "Abrindo…" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível abrir o documento.");
  });

  it("mostra a ação extra (Anexar, do Admin) ao lado de 'Abrir em nova aba'", () => {
    montar({ acaoExtra: <button type="button">Anexar alteração</button> });

    const abrir = screen.getByRole("button", { name: /^Abrir / });
    const anexar = screen.getByRole("button", { name: "Anexar alteração" });
    expect(abrir.parentElement).toBe(anexar.parentElement);
  });
});
