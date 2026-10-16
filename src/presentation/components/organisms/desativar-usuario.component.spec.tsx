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

  it("move o foco do teclado para Confirmar ao pedir confirmação", () => {
    renderizar({ confirmando: true });

    expect(screen.getByRole("button", { name: "Confirmar desativação de Jéssica" })).toHaveFocus();
  });

  it("desabilita Desativar enquanto pendente", () => {
    renderizar({ pendente: true });

    expect(screen.getByRole("button", { name: "Desativar Jéssica" })).toBeDisabled();
  });

  it("mostra o erro recebido num alerta", () => {
    renderizar({ erro: "Falhou." });

    expect(screen.getByRole("alert")).toHaveTextContent("Falhou.");
  });

  it("bloqueio pendente: Concluir bloqueio repete a ação direto, sem pedir confirmação", async () => {
    const { aoConfirmar, aoPedirConfirmacao } = renderizar({ bloqueioPendente: true });

    expect(screen.queryByRole("button", { name: "Desativar Jéssica" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Concluir bloqueio de Jéssica" }));

    expect(aoConfirmar).toHaveBeenCalled();
    expect(aoPedirConfirmacao).not.toHaveBeenCalled();
  });
});
