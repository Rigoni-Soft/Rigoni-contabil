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

  it("bloqueado: não fecha pelo véu, X marcado como desabilitado e Esc cancelado", () => {
    const { container } = render(
      <PainelModal
        painelId="p1"
        titulo="Leitura"
        rotuloDoFechar="Fechar leitura"
        aoFechar={jest.fn()}
        bloqueado
      >
        <p>Corpo</p>
      </PainelModal>,
    );

    const dialogo = container.querySelector("dialog") as HTMLDialogElement;
    expect(dialogo).toHaveAttribute("closedby", "none");
    expect(screen.getByRole("button", { name: "Fechar leitura", hidden: true })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    const esc = new Event("cancel", { cancelable: true });
    dialogo.dispatchEvent(esc);
    expect(esc.defaultPrevented).toBe(true);
  });

  it("livre: o Esc (cancel) segue o padrão do navegador", () => {
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

    const esc = new Event("cancel", { cancelable: true });
    container.querySelector("dialog")?.dispatchEvent(esc);

    expect(esc.defaultPrevented).toBe(false);
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
