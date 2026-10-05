import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AlterarPapel } from "./alterar-papel.component";

function renderizar(props: Partial<React.ComponentProps<typeof AlterarPapel>> = {}) {
  const aoAlterar = jest.fn();
  render(
    <AlterarPapel
      nome="Jéssica"
      papel="funcionario"
      pendente={false}
      aoAlterar={aoAlterar}
      {...props}
    />,
  );
  return aoAlterar;
}

describe("AlterarPapel", () => {
  it("Funcionário mostra Promover e dispara a troca", async () => {
    const aoAlterar = renderizar();

    await userEvent.click(
      screen.getByRole("button", { name: "Promover Jéssica a Líder de setor" }),
    );

    expect(aoAlterar).toHaveBeenCalled();
  });

  it("Líder mostra Rebaixar", () => {
    renderizar({ papel: "lider_setor" });

    expect(screen.getByRole("button", { name: "Rebaixar Jéssica a Funcionário" })).toBeEnabled();
  });

  it("desabilita o botão enquanto pendente", () => {
    renderizar({ pendente: true });

    expect(screen.getByRole("button", { name: /Promover Jéssica/ })).toBeDisabled();
  });

  it("mostra o erro recebido num alerta", () => {
    renderizar({ erro: "O setor já tem Líder ativo." });

    expect(screen.getByRole("alert")).toHaveTextContent("O setor já tem Líder ativo.");
  });
});
