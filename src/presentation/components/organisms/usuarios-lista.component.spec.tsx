import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { UsuariosLista } from "./usuarios-lista.component";

const usuarios = [
  { id: "a1", nome: "Cledson", email: "c@x.local", papel: "admin", setor: "administrativo" },
  { id: "f1", nome: "Jéssica", email: "j@x.local", papel: "funcionario", setor: "financeiro" },
];

function renderizar(props: Partial<React.ComponentProps<typeof UsuariosLista>> = {}) {
  const callbacks = {
    aoPedirConfirmacao: jest.fn(),
    aoCancelar: jest.fn(),
    aoConfirmar: jest.fn(),
  };
  render(<UsuariosLista usuarios={usuarios} {...callbacks} {...props} />);
  return callbacks;
}

describe("UsuariosLista", () => {
  it("não oferece desativar para Admin", () => {
    renderizar();

    expect(screen.queryByRole("button", { name: /Desativar Cledson/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Desativar Jéssica" })).toBeInTheDocument();
  });

  it("Desativar só pede confirmação, não desativa", async () => {
    const { aoPedirConfirmacao, aoConfirmar } = renderizar();

    await userEvent.click(screen.getByRole("button", { name: "Desativar Jéssica" }));

    expect(aoPedirConfirmacao).toHaveBeenCalledWith("f1");
    expect(aoConfirmar).not.toHaveBeenCalled();
  });

  it("em confirmação, mostra Confirmar e Cancelar do usuário alvo", async () => {
    const { aoConfirmar, aoCancelar } = renderizar({ confirmandoId: "f1" });

    await userEvent.click(screen.getByRole("button", { name: "Confirmar desativação de Jéssica" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(aoConfirmar).toHaveBeenCalledWith("f1");
    expect(aoCancelar).toHaveBeenCalled();
  });

  it("mostra o erro recebido num alerta", () => {
    renderizar({ erro: "Falhou." });

    expect(screen.getByRole("alert")).toHaveTextContent("Falhou.");
  });
});
