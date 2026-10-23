import { render, screen, within } from "@testing-library/react";

import { ComparativosSn } from "./comparativos-sn.component";

const DADOS = {
  das: [
    { id: "enviado", rotulo: "Enviada", quantidade: 4 },
    { id: "pendente", rotulo: "Pendente", quantidade: 2 },
    { id: "sem_movimento", rotulo: "Sem movimento", quantidade: 1 },
    { id: "pronto", rotulo: "Pronto", quantidade: 1 },
  ],
  parcelamento: [
    { id: "enviado", rotulo: "Enviado", quantidade: 1 },
    { id: "pendente", rotulo: "Pendente", quantidade: 1 },
    { id: "interno", rotulo: "Interno", quantidade: 1 },
  ],
  atividade: [
    { id: "industria", rotulo: "Indústria", quantidade: 2 },
    { id: "comercio", rotulo: "Comércio", quantidade: 5 },
    { id: "servico", rotulo: "Serviço", quantidade: 3 },
  ],
};

describe("ComparativosSn", () => {
  it("mostra os 3 gráficos com título e a contagem de cada fatia em texto", () => {
    render(<ComparativosSn comparativos={DADOS} totalClientes={8} />);

    expect(screen.getByRole("heading", { name: "Comparativos" })).toBeInTheDocument();
    const das = screen.getByRole("group", { name: "Status do DAS" });
    expect(within(das).getByText("Enviada")).toBeInTheDocument();
    expect(within(das).getAllByText("4").length).toBeGreaterThan(0);
    const parc = screen.getByRole("group", { name: "Status do parcelamento" });
    expect(within(parc).getByText("Interno")).toBeInTheDocument();
    expect(within(parc).getByText(/mais de uma situação/)).toBeInTheDocument();
    const ativ = screen.getByRole("group", { name: "Atividade do mês" });
    expect(within(ativ).getByText("Comércio")).toBeInTheDocument();
    expect(within(ativ).getByText("5")).toBeInTheDocument();
  });

  it("não quebra com todas as contagens zeradas", () => {
    const zerado = Object.fromEntries(
      Object.entries(DADOS).map(([k, v]) => [k, v.map((f) => ({ ...f, quantidade: 0 }))]),
    ) as typeof DADOS;

    render(<ComparativosSn comparativos={zerado} totalClientes={0} />);

    expect(screen.getByRole("group", { name: "Status do DAS" })).toBeInTheDocument();
  });
});
