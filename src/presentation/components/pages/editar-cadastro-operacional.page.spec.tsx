import { render, screen } from "@testing-library/react";

import { EditarCadastroOperacionalPage } from "./editar-cadastro-operacional.page";

const base = {
  header: <header>Topo</header>,
  titulo: "Editar cadastro operacional",
  formulario: <form aria-label="Cadastro do SN" />,
};

describe("EditarCadastroOperacionalPage", () => {
  it("sem nada do RH, mostra só o formulário", () => {
    render(<EditarCadastroOperacionalPage {...base} />);

    expect(screen.getByRole("form", { name: "Cadastro do SN" })).toBeInTheDocument();
    expect(screen.queryByText("Mês RH")).not.toBeInTheDocument();
  });

  it("o acompanhamento do RH forma um cartão abaixo do formulário mesmo sem as observações", () => {
    render(
      <EditarCadastroOperacionalPage
        {...base}
        acompanhamentoRh={<p>Mês RH</p>}
        observacoesRh={undefined}
      />,
    );

    const formulario = screen.getByRole("form", { name: "Cadastro do SN" });
    const rh = screen.getByText("Mês RH");
    expect(formulario.compareDocumentPosition(rh) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("acompanhamento e observações do RH ficam no mesmo cartão", () => {
    render(
      <EditarCadastroOperacionalPage
        {...base}
        acompanhamentoRh={<p>Mês RH</p>}
        observacoesRh={<p>Observações RH</p>}
      />,
    );

    expect(screen.getByText("Mês RH").parentElement).toBe(
      screen.getByText("Observações RH").parentElement,
    );
  });
});
