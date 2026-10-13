import { render, screen } from "@testing-library/react";

import { TelaDeTrabalhoTemplate } from "./tela-de-trabalho-template.component";

describe("TelaDeTrabalhoTemplate", () => {
  it("monta cabeçalho, nav, Voltar, título, descrição e conteúdo nos slots", () => {
    render(
      <TelaDeTrabalhoTemplate
        header={<header>topo</header>}
        nav={<nav>abas</nav>}
        largura="lista"
        voltarHref="/atras"
        voltarRotulo="Voltar ao resumo"
        titulo="Usuários"
        descricao="Quem acessa o sistema."
        conteudo={<p>lista</p>}
      />,
    );

    expect(screen.getByText("topo")).toBeInTheDocument();
    expect(screen.getByText("abas")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar ao resumo" })).toHaveAttribute(
      "href",
      "/atras",
    );
    expect(screen.getByRole("heading", { level: 1, name: "Usuários" })).toBeInTheDocument();
    expect(screen.getByText("Quem acessa o sistema.")).toBeInTheDocument();
    expect(screen.getByText("lista")).toBeInTheDocument();
  });

  it("sem voltarHref e sem título não renderiza link nem h1", () => {
    render(
      <TelaDeTrabalhoTemplate header={<header>topo</header>} largura="conteudo" conteudo="busca" />,
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("busca");
  });

  it("a largura vem da categoria da tela", () => {
    const { container } = render(
      <TelaDeTrabalhoTemplate header={null} largura="formulario" conteudo="x" />,
    );

    expect(container.querySelector("main > div")).toHaveClass("w-[80%]");
  });
});
