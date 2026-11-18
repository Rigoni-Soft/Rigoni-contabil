import { fireEvent, render, screen } from "@testing-library/react";

import { VoltarAoHistoricoContainer } from "./voltar-ao-historico.container";

const back = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ back }) }));

describe("VoltarAoHistoricoContainer", () => {
  beforeEach(() => back.mockReset());

  it("com histórico, volta à tela anterior em vez de seguir o link", () => {
    window.history.pushState({}, "", "/a");
    window.history.pushState({}, "", "/perfil");
    render(<VoltarAoHistoricoContainer />);

    fireEvent.click(screen.getByRole("link", { name: "Voltar" }));

    expect(back).toHaveBeenCalledTimes(1);
  });

  it("aponta para o início quando não há histórico para voltar", () => {
    render(<VoltarAoHistoricoContainer />);

    expect(screen.getByRole("link", { name: "Voltar" })).toHaveAttribute("href", "/");
  });
});
