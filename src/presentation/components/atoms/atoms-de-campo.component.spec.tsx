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

    expect(screen.getByText("Selecionar arquivo…")).toBeInTheDocument();
    const arquivo = new File(["x"], "contrato.pdf", { type: "application/pdf" });
    fireEvent.change(document.getElementById("contrato") as HTMLInputElement, {
      target: { files: [arquivo] },
    });

    expect(aoMudar).toHaveBeenCalledWith(arquivo);
  });
});
