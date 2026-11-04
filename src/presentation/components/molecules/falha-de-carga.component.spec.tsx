import { render, screen } from "@testing-library/react";

import { FalhaDeCarga } from "./falha-de-carga.component";

describe("FalhaDeCarga", () => {
  it("anuncia o erro e oferece tentar de novo na própria rota", () => {
    render(<FalhaDeCarga texto="Não foi possível carregar." tentarNovamenteHref="/clientes/1" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível carregar.");
    expect(screen.getByRole("link", { name: /tentar novamente/i })).toHaveAttribute(
      "href",
      "/clientes/1",
    );
  });

  it("sem rota, mostra só o erro", () => {
    render(<FalhaDeCarga texto="Falhou." />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
