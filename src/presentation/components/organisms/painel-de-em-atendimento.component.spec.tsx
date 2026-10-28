import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PainelDeEmAtendimento } from "./painel-de-em-atendimento.component";

const ITENS = [{ id: "c", titulo: "Ana", detalhe: "Loja ME", previa: "Oi", aguardando: true }];

describe("PainelDeEmAtendimento", () => {
  it("clicar no card abre a conversa e marca a aberta", async () => {
    const onAbrir = jest.fn();
    render(<PainelDeEmAtendimento itens={ITENS} abertoId="c" onAbrir={onAbrir} />);

    const card = screen.getByRole("button", { name: /Ana/ });
    expect(card).toHaveAttribute("aria-current", "true");

    await userEvent.click(card);
    expect(onAbrir).toHaveBeenCalledWith("c");
  });

  it("sem atendimentos, avisa", () => {
    render(<PainelDeEmAtendimento itens={[]} abertoId={null} onAbrir={jest.fn()} />);

    expect(screen.getByText("Você não tem atendimentos em andamento.")).toBeInTheDocument();
  });
});
