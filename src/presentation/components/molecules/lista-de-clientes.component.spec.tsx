import { render, screen } from "@testing-library/react";

import { ListaDeClientes } from "./lista-de-clientes.component";

describe("ListaDeClientes", () => {
  it("cada linha mostra empresa e CNPJ mascarado e leva ao href dela, com o detalhe abaixo", () => {
    render(
      <ListaDeClientes
        clientes={[
          {
            clienteId: "c1",
            empresa: "Padaria Sol",
            cnpj: "90000001000129",
            href: "/clientes/c1?voltarPara=%2Frh",
            detalhes: <p>3 meses</p>,
          },
        ]}
      />,
    );

    const link = screen.getByRole("link", { name: /Padaria Sol/ });
    expect(link).toHaveAttribute("href", "/clientes/c1?voltarPara=%2Frh");
    expect(link).toHaveTextContent("90.000.001/0001-29");
    expect(link).toHaveTextContent("Ver cadastro");
    expect(screen.getByText("3 meses")).toBeInTheDocument();
  });
});
