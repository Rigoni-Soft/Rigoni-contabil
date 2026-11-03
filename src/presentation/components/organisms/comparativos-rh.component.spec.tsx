import { render, screen } from "@testing-library/react";

import { ComparativosRh } from "./comparativos-rh.component";

describe("ComparativosRh", () => {
  it("mostra o título e o comparativo de Clientes por Responsável", () => {
    render(
      <ComparativosRh
        responsaveis={[
          { id: "u1", rotulo: "Ana", cor: "em_dia", quantidade: 2 },
          { id: "sem", rotulo: "Sem responsável", cor: "informativo", quantidade: 1 },
        ]}
        totalClientes={3}
      />,
    );

    expect(screen.getByRole("heading", { name: "Comparativos" })).toBeInTheDocument();
    expect(screen.getByText("Clientes por Responsável")).toBeInTheDocument();
    expect(screen.getAllByText(/Ana/).length).toBeGreaterThan(0);
  });
});
