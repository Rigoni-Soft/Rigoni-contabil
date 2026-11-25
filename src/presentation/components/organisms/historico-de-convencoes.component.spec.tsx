import { render, screen } from "@testing-library/react";

import { HistoricoDeConvencoes } from "./historico-de-convencoes.component";

describe("HistoricoDeConvencoes", () => {
  const itens = [
    {
      id: "cv1",
      sindicato: "Comércio",
      vigencia: "01/05/2026 a 30/04/2027",
      arquivoNome: "cct-2026.pdf",
      enviadaEm: "11/11/2026",
      href: "/rh/x?convencao=cv1",
      selecionada: true,
    },
    {
      id: "cv0",
      sindicato: "Comércio",
      vigencia: "01/05/2025 a 30/04/2026",
      arquivoNome: "cct-2025.pdf",
      enviadaEm: "02/05/2025",
      href: "/rh/x?convencao=cv0",
      selecionada: false,
    },
  ];

  it("lista o histórico e marca como atual só a que está em tela", () => {
    render(<HistoricoDeConvencoes itens={itens} podeEnviar />);

    const atual = screen.getByRole("link", { name: /01\/05\/2026 a 30\/04\/2027/ });
    const antiga = screen.getByRole("link", { name: /01\/05\/2025 a 30\/04\/2026/ });
    expect(atual).toHaveAttribute("aria-current", "true");
    expect(antiga).not.toHaveAttribute("aria-current");
    expect(antiga).toHaveAttribute("href", "/rh/x?convencao=cv0");
    expect(screen.getByText("cct-2025.pdf · enviada em 02/05/2025")).toBeInTheDocument();
  });

  it("sem convenção, convida a enviar (quem pode) ou diz quem envia (quem só lê)", () => {
    const { rerender } = render(<HistoricoDeConvencoes itens={[]} podeEnviar />);
    expect(screen.getByText(/Envie a primeira abaixo/)).toBeInTheDocument();

    rerender(<HistoricoDeConvencoes itens={[]} podeEnviar={false} />);
    expect(screen.getByText(/O Líder do RH ou o Admin envia o PDF/)).toBeInTheDocument();
  });
});
