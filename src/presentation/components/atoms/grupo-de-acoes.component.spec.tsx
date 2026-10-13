import { render, screen } from "@testing-library/react";

import { GrupoDeAcoes } from "./grupo-de-acoes.component";

describe("GrupoDeAcoes", () => {
  it("renderiza as ações lado a lado", () => {
    render(
      <GrupoDeAcoes>
        <button type="button">Papel</button>
        <button type="button">Desativar</button>
      </GrupoDeAcoes>,
    );

    expect(screen.getByRole("button", { name: "Papel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Desativar" })).toBeInTheDocument();
  });
});
