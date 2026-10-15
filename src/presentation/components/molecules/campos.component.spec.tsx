import { render, screen } from "@testing-library/react";

import { CampoSelect } from "./campo-select.component";
import { CampoTextarea } from "./campo-textarea.component";

describe("CampoSelect", () => {
  it("liga o rótulo ao seletor e mostra as opções", () => {
    render(
      <CampoSelect id="setor" rotulo="Setor de destino" defaultValue="">
        <option value="">Escolha</option>
        <option value="rh">RH</option>
      </CampoSelect>,
    );

    expect(screen.getByLabelText("Setor de destino")).toHaveValue("");
    expect(screen.getByRole("option", { name: "RH" })).toBeInTheDocument();
  });
});

describe("CampoTextarea", () => {
  it("liga o rótulo ao campo", () => {
    render(<CampoTextarea id="resumo" rotulo="Resumo do assunto" />);

    expect(screen.getByLabelText("Resumo do assunto")).toBeInTheDocument();
  });

  it("rótulo oculto continua acessível, só não aparece", () => {
    render(<CampoTextarea id="msg" rotulo="Mensagem ao cliente" rotuloOculto />);

    expect(screen.getByLabelText("Mensagem ao cliente")).toBeInTheDocument();
    expect(screen.getByText("Mensagem ao cliente")).toHaveClass("sr-only");
  });
});
