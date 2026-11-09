import { render, screen, within } from "@testing-library/react";

import { AcompanhamentoDosFuncionarios } from "./acompanhamento-dos-funcionarios.component";

const BASE = {
  rotuloMes: "novembro de 2026",
  anteriorHref: "?mes=2026-10",
  semResponsavel: [],
};

const ANA = {
  id: "ana",
  nome: "Ana",
  atribuidos: 4,
  pontos: 3,
  percentual: 75,
  href: "/rh/funcionarios/ana",
  faltam: [
    { servicoId: "fgts", nome: "FGTS", clientes: 1, href: "/rh/funcionarios/ana/fgts" },
    { servicoId: "sib", nome: "SIB", clientes: 0, href: "/rh/funcionarios/ana/sib" },
  ],
};

describe("AcompanhamentoDosFuncionarios", () => {
  it("lista o funcionário com os pontos e o link do detalhe, e as faltas por serviço", () => {
    render(<AcompanhamentoDosFuncionarios {...BASE} funcionarios={[ANA]} />);

    expect(screen.getByRole("link", { name: "Ana" })).toHaveAttribute(
      "href",
      "/rh/funcionarios/ana",
    );
    expect(screen.getByText("3 de 4")).toBeInTheDocument();

    const tabela = screen.getByRole("table", { name: /faltam por serviço em novembro de 2026/ });
    expect(within(tabela).getByRole("columnheader", { name: "FGTS" })).toBeInTheDocument();
    expect(within(tabela).getByRole("columnheader", { name: "SIB" })).toBeInTheDocument();
    expect(
      within(tabela).getByRole("row", { name: /FGTS de Ana: 1 SIB de Ana: 0/ }),
    ).toBeInTheDocument();
  });

  it("sem funcionários mostra o vazio e nem a tabela nem a nota de ponto", () => {
    render(<AcompanhamentoDosFuncionarios {...BASE} funcionarios={[]} />);

    expect(screen.getByText("Nenhum cliente atribuído ainda.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText(/Um ponto por cliente/)).not.toBeInTheDocument();
  });

  it("clientes sem responsável aparecem num bloco à parte", () => {
    render(
      <AcompanhamentoDosFuncionarios
        {...BASE}
        funcionarios={[ANA]}
        semResponsavel={[{ clienteId: "c1", empresa: "Padaria Sol", href: "/clientes/c1" }]}
      />,
    );

    expect(screen.getByText("Sem responsável")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Padaria Sol" })).toHaveAttribute(
      "href",
      "/clientes/c1",
    );
  });

  it("cada célula da tabela de faltas abre a lista das empresas daquele serviço", () => {
    render(<AcompanhamentoDosFuncionarios {...BASE} funcionarios={[ANA]} />);

    expect(screen.getByRole("link", { name: "FGTS de Ana: 1" })).toHaveAttribute(
      "href",
      "/rh/funcionarios/ana/fgts",
    );
    expect(screen.getByRole("link", { name: "SIB de Ana: 0" })).toHaveAttribute(
      "href",
      "/rh/funcionarios/ana/sib",
    );
  });
});
