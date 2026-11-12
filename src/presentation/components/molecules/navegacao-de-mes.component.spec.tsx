import { render, screen } from "@testing-library/react";

import { NavegacaoDeMes } from "./navegacao-de-mes.component";

describe("NavegacaoDeMes", () => {
  it("mostra o mês em tela e os links para o anterior e o próximo", () => {
    render(
      <NavegacaoDeMes
        rotuloMes="outubro de 2026"
        anteriorHref="?mes=2026-09"
        proximoHref="?mes=2026-11"
      />,
    );

    expect(screen.getByRole("navigation", { name: "Mês do acompanhamento" })).toBeInTheDocument();
    expect(screen.getByText("outubro de 2026")).toHaveAttribute("aria-current", "date");
    expect(screen.getByRole("link", { name: "Mês anterior" })).toHaveAttribute(
      "href",
      "?mes=2026-09",
    );
    expect(screen.getByRole("link", { name: "Próximo mês" })).toHaveAttribute(
      "href",
      "?mes=2026-11",
    );
  });

  it("sem próximo (mês corrente) não mostra o link de avanço", () => {
    render(<NavegacaoDeMes rotuloMes="novembro de 2026" anteriorHref="?mes=2026-10" />);

    expect(screen.getByRole("link", { name: "Mês anterior" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Próximo mês" })).not.toBeInTheDocument();
    expect(screen.getByText(/indisponível: este é o mês corrente/)).toBeInTheDocument();
  });

  it("com destaque, o mês vem em negrito dentro da faixa", () => {
    render(<NavegacaoDeMes rotuloMes="novembro de 2026" anteriorHref="?mes=2026-10" destaque />);

    expect(screen.getByText("novembro de 2026")).toHaveClass("font-semibold");
    expect(screen.getByRole("navigation", { name: "Mês do acompanhamento" })).toHaveClass(
      "bg-muted/50",
    );
  });

  it("o mês anterior fica rente à esquerda, simétrico ao próximo rente à direita", () => {
    render(<NavegacaoDeMes rotuloMes="novembro de 2026" anteriorHref="/a" proximoHref="/p" />);

    expect(screen.getByRole("link", { name: /Mês anterior/ })).toHaveClass("justify-self-start");
  });
});
