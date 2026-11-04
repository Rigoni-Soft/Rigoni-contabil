import { render, screen } from "@testing-library/react";

import { ResumoSetorListaPage } from "./resumo-setor-lista.page";

describe("ResumoSetorListaPage", () => {
  it("mostra a lista e o link de volta ao resumo do Setor", () => {
    render(
      <ResumoSetorListaPage
        header={<header />}
        titulo="Atribuídos"
        voltarHref="/rh"
        lista={<p>Empresa A</p>}
      />,
    );

    expect(screen.getByText("Empresa A")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /voltar ao resumo/i })).toHaveAttribute("href", "/rh");
  });

  it("sem lista (falha de leitura), mostra o erro e mantém o caminho de volta", () => {
    render(
      <ResumoSetorListaPage
        header={<header />}
        titulo="Resumo do setor"
        voltarHref="/rh"
        erro="Falha ao carregar o resumo do setor. Tente novamente."
        tentarNovamenteHref="/rh/resumo/atribuidos"
      />,
    );

    expect(screen.getByText(/falha ao carregar o resumo do setor/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /voltar ao resumo/i })).toHaveAttribute("href", "/rh");
    expect(screen.getByRole("link", { name: /tentar novamente/i })).toHaveAttribute(
      "href",
      "/rh/resumo/atribuidos",
    );
  });
});
