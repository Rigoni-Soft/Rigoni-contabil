import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PainelModal } from "./painel-modal.component";

describe("PainelModal", () => {
  it("é um dialog nomeado pelo título, com o corpo dentro e fechamento pelo véu", () => {
    const { container } = render(
      <PainelModal
        painelId="p1"
        titulo="Avisos"
        rotuloDoFechar="Fechar avisos"
        aoFechar={jest.fn()}
      >
        <p>Corpo</p>
      </PainelModal>,
    );

    const dialogo = container.querySelector("dialog");
    expect(dialogo).toHaveAttribute("id", "p1");
    expect(dialogo).toHaveAttribute("aria-labelledby", "p1-titulo");
    expect(dialogo).toHaveAttribute("closedby", "any");
    expect(container.querySelector("#p1-titulo")).toHaveTextContent("Avisos");
    expect(dialogo).toHaveTextContent("Corpo");
  });

  it("o X chama aoFechar e tem o nome acessível pedido", async () => {
    const aoFechar = jest.fn();
    render(
      <PainelModal painelId="p1" titulo="Avisos" rotuloDoFechar="Fechar avisos" aoFechar={aoFechar}>
        <p>Corpo</p>
      </PainelModal>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Fechar avisos", hidden: true }));

    expect(aoFechar).toHaveBeenCalledTimes(1);
  });
});
