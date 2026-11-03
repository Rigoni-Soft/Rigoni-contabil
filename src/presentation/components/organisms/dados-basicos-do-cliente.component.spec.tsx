import { render, screen } from "@testing-library/react";

import { DadosBasicosDoCliente } from "./dados-basicos-do-cliente.component";

describe("DadosBasicosDoCliente", () => {
  it("mostra empresa, CNPJ formatado e regime como lista de definição", () => {
    render(
      <DadosBasicosDoCliente
        empresa="Padaria Sol Ltda"
        cnpj="11444777000161"
        regime="Lucro Presumido"
      />,
    );

    expect(screen.getByText("Empresa").tagName).toBe("DT");
    expect(screen.getByText("Padaria Sol Ltda").tagName).toBe("DD");
    expect(screen.getByText("11.444.777/0001-61")).toBeInTheDocument();
    expect(screen.getByText("Lucro Presumido")).toBeInTheDocument();
  });
});
