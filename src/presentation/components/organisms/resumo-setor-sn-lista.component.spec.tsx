import { render, screen } from "@testing-library/react";

import { ResumoSetorSnLista } from "./resumo-setor-sn-lista.component";

describe("ResumoSetorSnLista", () => {
  it("lista cada cliente com empresa, cnpj formatado e link pra /clientes/[id]", () => {
    render(
      <ResumoSetorSnLista
        clientes={[{ clienteId: "c1", empresa: "Padaria Pão Quente Ltda", cnpj: "11444777000161" }]}
      />,
    );

    expect(screen.getByText("Padaria Pão Quente Ltda")).toBeInTheDocument();
    expect(screen.getByText("11.444.777/0001-61")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/clientes/c1");
  });

  it("mostra uma mensagem quando o bucket está vazio", () => {
    render(<ResumoSetorSnLista clientes={[]} />);

    expect(screen.getByText("Nenhum cliente neste status.")).toBeInTheDocument();
  });
});
