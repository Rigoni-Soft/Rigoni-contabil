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

  it("com a equipe, cada lista ganha um título visível e a da equipe abre em leitura", async () => {
    const onAbrir = jest.fn();
    const equipe = [{ id: "e", titulo: "Joana", detalhe: "Mercado · com Caio" }];
    render(
      <PainelDeEmAtendimento itens={ITENS} abertoId={null} onAbrir={onAbrir} equipe={equipe} />,
    );

    expect(screen.getByRole("heading", { name: "Meus atendimentos" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Da equipe (somente leitura)" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Joana/ }));
    expect(onAbrir).toHaveBeenCalledWith("e");
  });

  it("sem a equipe não repete o título da lista única", () => {
    render(<PainelDeEmAtendimento itens={ITENS} abertoId={null} onAbrir={jest.fn()} />);

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});
