import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ShellNavContainer } from "./shell-nav.container";

const push = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
jest.mock("./use-pendentes-do-menu.hook", () => ({
  usePendentesDoMenu: () => ({ total: 3, pronto: true }),
}));
jest.mock("./use-anuncio-do-menu.hook", () => ({ useAnuncioDoMenu: () => "na fila" }));

describe("ShellNavContainer", () => {
  it("mostra os pendentes e o anúncio do hook", () => {
    render(<ShellNavContainer setores={[]} rotaAtual="/inicio" />);

    expect(screen.getByRole("link", { name: "Atendimento, 3 pendentes" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("na fila");
  });

  it("escolher um Setor com tela navega pelo router", async () => {
    render(
      <ShellNavContainer
        setores={[{ slug: "simples_nacional" }, { slug: "contabil" }, { slug: "rh" }]}
        rotaAtual="/inicio"
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText("Ir para o Setor"), "simples_nacional");

    expect(push).toHaveBeenCalledWith("/simples-nacional");
  });
});
