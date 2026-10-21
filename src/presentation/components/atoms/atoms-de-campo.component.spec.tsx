import { fireEvent, render, screen } from "@testing-library/react";

import { FieldError } from "./field-error.component";
import { FileInput } from "./file-input.component";
import { RequiredMark } from "./required-mark.component";

describe("átomos de campo", () => {
  it("FieldError anuncia o erro como alerta, com texto", () => {
    render(<FieldError>Informe o CNPJ.</FieldError>);

    expect(screen.getByRole("alert")).toHaveTextContent("Informe o CNPJ.");
  });

  it("RequiredMark é visual: fica fora da árvore de acessibilidade", () => {
    const { container } = render(<RequiredMark />);

    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(container).toHaveTextContent("*");
  });

  it("FileInput mostra o placeholder e entrega o arquivo escolhido", () => {
    const aoMudar = jest.fn();
    render(<FileInput id="contrato" onChange={aoMudar} />);

    expect(screen.getByText("Arraste o arquivo aqui")).toBeInTheDocument();
    const arquivo = new File(["x"], "contrato.pdf", { type: "application/pdf" });
    fireEvent.change(document.getElementById("contrato") as HTMLInputElement, {
      target: { files: [arquivo] },
    });

    expect(aoMudar).toHaveBeenCalledWith(arquivo);
  });

  it("FileInput aceita arquivo arrastado e solto", () => {
    const aoMudar = jest.fn();
    render(<FileInput id="contrato" onChange={aoMudar} />);

    const arquivo = new File(["x"], "solto.pdf", { type: "application/pdf" });
    const area = screen.getByText("Arraste o arquivo aqui").closest("label") as HTMLLabelElement;
    fireEvent.dragOver(area);
    expect(area.dataset.arrastando).toBe("true");
    fireEvent.drop(area, { dataTransfer: { files: [arquivo] } });

    expect(area.dataset.arrastando).toBe("false");
    expect(aoMudar).toHaveBeenCalledWith(arquivo);
  });

  it("FileInput deixa as instruções e a dica fora do nome acessível, e mantém o nome do arquivo", () => {
    const { rerender } = render(
      <>
        <label htmlFor="contrato">Contrato social</label>
        <FileInput id="contrato" dica="PDF ou DOCX" onChange={jest.fn()} />
      </>,
    );
    expect(screen.getByText("Arraste o arquivo aqui")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("ou clique para selecionar").closest("[aria-hidden]")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(screen.getByText("PDF ou DOCX").closest("[aria-hidden]")).toHaveAttribute(
      "aria-hidden",
      "true",
    );

    const arquivo = new File(["x"], "contrato.pdf", { type: "application/pdf" });
    rerender(
      <>
        <label htmlFor="contrato">Contrato social</label>
        <FileInput id="contrato" file={arquivo} onChange={jest.fn()} />
      </>,
    );
    expect(screen.getByText("contrato.pdf")).not.toHaveAttribute("aria-hidden");
  });
});
