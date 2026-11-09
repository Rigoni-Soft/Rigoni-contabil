import { render, screen, within } from "@testing-library/react";

import { ComparativosRh } from "./comparativos-rh.component";

const ACOMPANHAMENTO = [
  { id: "concluido", rotulo: "Tudo concluído", cor: "em_dia", quantidade: 1 },
  { id: "pendente", rotulo: "Com pendência", cor: "atencao", quantidade: 2 },
];
const PARCELAMENTO = [
  { id: "enviado", rotulo: "Enviado", cor: "em_dia", quantidade: 0 },
  { id: "pendente", rotulo: "Pendente", cor: "atencao", quantidade: 0 },
];
const RESPONSAVEIS = [
  {
    id: "u1",
    rotulo: "Ana",
    cor: "em_dia",
    quantidade: 2,
    href: "/rh/funcionarios/u1?mes=2026-11",
  },
  { id: "sem", rotulo: "Sem responsável", cor: "informativo", quantidade: 1 },
];

describe("ComparativosRh", () => {
  it("mostra o donut do acompanhamento e as barras do parcelamento, como o SN", () => {
    render(
      <ComparativosRh
        acompanhamento={ACOMPANHAMENTO}
        parcelamento={PARCELAMENTO}
        totalClientes={3}
      />,
    );

    expect(screen.getByRole("heading", { name: "Comparativos" })).toBeInTheDocument();
    const acompanhamento = screen.getByRole("group", { name: "Status do acompanhamento" });
    expect(within(acompanhamento).getByText("Com pendência")).toBeInTheDocument();
    expect(screen.getByText("Status do parcelamento")).toBeInTheDocument();
    expect(screen.queryByText("Clientes por Responsável")).not.toBeInTheDocument();
  });

  it("o Líder vê Clientes por Responsável e o card inteiro abre o acompanhamento dos funcionários", () => {
    render(
      <ComparativosRh
        acompanhamento={ACOMPANHAMENTO}
        parcelamento={PARCELAMENTO}
        responsaveis={RESPONSAVEIS}
        responsaveisHref="/rh/funcionarios"
        totalClientes={3}
      />,
    );

    const link = screen.getByRole("link", { name: /Clientes por Responsável/ });
    expect(link).toHaveAttribute("href", "/rh/funcionarios");
    expect(within(link).getByText("Ana")).toBeInTheDocument();
    expect(within(link).getByText("Sem responsável")).toBeInTheDocument();
  });
});
