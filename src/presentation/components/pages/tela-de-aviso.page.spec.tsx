import { render, screen } from "@testing-library/react";

import { TelaDeAvisoPage } from "./tela-de-aviso.page";

describe("TelaDeAvisoPage", () => {
  it("anuncia o aviso como alerta e mostra as ações", () => {
    render(
      <TelaDeAvisoPage
        subtitulo="Algo deu errado"
        aviso="Não foi possível carregar esta tela."
        rodape="Avise o suporte."
        acoes={<button type="button">Tentar de novo</button>}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível carregar esta tela.");
    expect(screen.getByText("Algo deu errado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
  });
});
