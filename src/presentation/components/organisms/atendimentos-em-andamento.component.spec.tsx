import { render, screen } from "@testing-library/react";

import { AtendimentosEmAndamento } from "./atendimentos-em-andamento.component";

describe("AtendimentosEmAndamento", () => {
  it("lista cada Atendimento com link para a conversa", () => {
    render(
      <AtendimentosEmAndamento
        atendimentos={[
          {
            id: "at-1",
            href: "/atendimento/at-1",
            titulo: "Maria",
            detalhe: "Padaria Ltda",
            previa: null,
            aguardando: false,
            sinal: "",
          },
        ]}
      />,
    );

    const link = screen.getByRole("link", { name: /Maria/ });
    expect(link).toHaveAttribute("href", "/atendimento/at-1");
    expect(screen.getByText("Padaria Ltda")).toBeInTheDocument();
  });

  it("sem Atendimento não renderiza nada", () => {
    const { container } = render(<AtendimentosEmAndamento atendimentos={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
