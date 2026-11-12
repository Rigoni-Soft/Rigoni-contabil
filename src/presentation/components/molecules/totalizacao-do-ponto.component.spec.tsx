import { render, screen } from "@testing-library/react";

import { TotalizacaoDoPonto } from "./totalizacao-do-ponto.component";

describe("TotalizacaoDoPonto", () => {
  it("lista cada total com o seu valor", () => {
    render(
      <TotalizacaoDoPonto
        titulo="Totalização da quinzena"
        itens={[
          { rotulo: "Horas normais", valor: "8h45" },
          { rotulo: "Faltas", valor: "1 dia" },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Totalização da quinzena" })).toBeInTheDocument();
    expect(screen.getByText("Horas normais")).toBeInTheDocument();
    expect(screen.getByText("8h45")).toBeInTheDocument();
    expect(screen.getByText("1 dia")).toBeInTheDocument();
  });
});
