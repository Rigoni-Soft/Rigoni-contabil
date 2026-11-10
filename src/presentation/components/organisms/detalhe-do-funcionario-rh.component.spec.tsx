import { render, screen } from "@testing-library/react";

import { DetalheDoFuncionarioRh } from "./detalhe-do-funcionario-rh.component";

const BASE = {
  nome: "Ana",
  rotuloMes: "novembro de 2026",
  pontos: 3,
  atribuidos: 4,
  percentual: 75,
  pendencias: [],
  evolucao: [],
  maisAtrasados: [],
};

describe("DetalheDoFuncionarioRh", () => {
  it("agrupa os clientes pendentes pelo serviço que falta", () => {
    render(
      <DetalheDoFuncionarioRh
        {...BASE}
        pendencias={[
          {
            servicoId: "fgts",
            nome: "FGTS",
            clientes: [
              {
                clienteId: "c1",
                empresa: "Padaria Sol",
                cnpj: "90000001000129",
                href: "/clientes/c1",
              },
            ],
          },
        ]}
        evolucao={[{ competencia: "2026-10", rotulo: "outubro", percentual: 50 }]}
        maisAtrasados={[
          {
            clienteId: "c1",
            empresa: "Padaria Sol",
            cnpj: "90000001000129",
            href: "/clientes/c1",
            meses: 1,
          },
          {
            clienteId: "c2",
            empresa: "Mercado Lua",
            cnpj: "90000002000173",
            href: "/clientes/c2",
            meses: 3,
          },
        ]}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Ana: 75% em novembro de 2026 (3 de 4)" }),
    ).toBeInTheDocument();
    expect(screen.getByText("FGTS (1)")).toBeInTheDocument();
    expect(screen.getByText("outubro")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("1 mês")).toBeInTheDocument();
    expect(screen.getByText("3 meses")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Padaria Sol/ })[0]).toHaveAttribute(
      "href",
      "/clientes/c1",
    );
  });

  it("sem pendência, evolução nem atraso mostra os três estados vazios", () => {
    render(<DetalheDoFuncionarioRh {...BASE} />);

    expect(screen.getByText("Tudo concluído neste mês.")).toBeInTheDocument();
    expect(screen.getByText("Sem meses anteriores para comparar.")).toBeInTheDocument();
    expect(screen.getByText("Nenhum cliente atrasado.")).toBeInTheDocument();
  });
});
