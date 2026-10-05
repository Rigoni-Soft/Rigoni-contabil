import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DesativarUsuario } from "./desativar-usuario.component";

function renderizar(props: Partial<React.ComponentProps<typeof DesativarUsuario>> = {}) {
  const callbacks = {
    aoPedirConfirmacao: jest.fn(),
    aoCancelar: jest.fn(),
    aoConfirmar: jest.fn(),
  };
  render(
    <DesativarUsuario
      nome="Jéssica"
      confirmando={false}
      pendente={false}
      {...callbacks}
      {...props}
    />,
  );
  return callbacks;
}

describe("DesativarUsuario", () => {
  it("Desativar só pede confirmação, não desativa", async () => {
    const { aoPedirConfirmacao, aoConfirmar } = renderizar();

    await userEvent.click(screen.getByRole("button", { name: "Desativar Jéssica" }));

    expect(aoPedirConfirmacao).toHaveBeenCalled();
    expect(aoConfirmar).not.toHaveBeenCalled();
  });

  it("em confirmação, mostra Confirmar e Cancelar", async () => {
    const { aoConfirmar, aoCancelar } = renderizar({ confirmando: true });

    await userEvent.click(screen.getByRole("button", { name: "Confirmar desativação de Jéssica" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(aoConfirmar).toHaveBeenCalled();
    expect(aoCancelar).toHaveBeenCalled();
  });

  it("desabilita Desativar enquanto pendente", () => {
    renderizar({ pendente: true });

    expect(screen.getByRole("button", { name: "Desativar Jéssica" })).toBeDisabled();
  });

  it("mostra o erro recebido num alerta", () => {
    renderizar({ erro: "Falhou." });

    expect(screen.getByRole("alert")).toHaveTextContent("Falhou.");
  });
});
