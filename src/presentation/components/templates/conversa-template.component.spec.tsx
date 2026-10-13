import { render, screen } from "@testing-library/react";

import { ConversaTemplate } from "./conversa-template.component";

const SLOTS = {
  header: <header>topo</header>,
  voltar: <button type="button">voltar</button>,
  cabecalho: <h1>cabeçalho</h1>,
  mensagens: <ol aria-label="Mensagens" />,
  compositor: <form aria-label="compositor" />,
};

describe("ConversaTemplate", () => {
  it("monta os slots na página", () => {
    render(<ConversaTemplate {...SLOTS} acoes={<aside>ações</aside>} />);

    expect(screen.getByText("topo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "voltar" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "cabeçalho" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Mensagens" })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "compositor" })).toBeInTheDocument();
    expect(screen.getByRole("complementary")).toHaveTextContent("ações");
  });

  it("em tela larga a página não rola; com ações abre a segunda coluna", () => {
    render(<ConversaTemplate {...SLOTS} acoes={<aside>ações</aside>} />);

    expect(screen.getByRole("main").parentElement).toHaveClass("lg:h-dvh", "lg:overflow-hidden");
    expect(screen.getByRole("region", { name: "Atendimento" }).className).toContain(
      "lg:grid-cols-",
    );
  });

  it("sem ações (encerrado) o chat ocupa a largura toda", () => {
    render(<ConversaTemplate {...SLOTS} />);

    // Sem Fila nem ações não há coluna extra em nenhuma largura (só a coluna única).
    expect(screen.getByRole("region", { name: "Atendimento" }).className).not.toMatch(
      /(sm|md|lg|xl|2xl):grid-cols-/,
    );
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("em tela estreita a coluna única não cresce com palavra longa (minmax(0,1fr))", () => {
    render(<ConversaTemplate {...SLOTS} />);

    expect(screen.getByRole("region", { name: "Atendimento" })).toHaveClass(
      "grid-cols-[minmax(0,1fr)]",
    );
  });
});
