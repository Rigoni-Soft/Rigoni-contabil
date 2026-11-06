import { render, screen } from "@testing-library/react";

import { EntradaTemplate } from "./entrada-template.component";

describe("EntradaTemplate", () => {
  it("mostra título, subtítulo, formulário e rodapé", () => {
    render(
      <EntradaTemplate
        titulo="Rigoni Contábil"
        subtitulo="Entrar no sistema interno"
        rodape="Acesso restrito."
        formulario={<form aria-label="login" />}
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Rigoni Contábil" })).toBeInTheDocument();
    expect(screen.getByText("Entrar no sistema interno")).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "login" })).toBeInTheDocument();
    expect(screen.getByText("Acesso restrito.")).toBeInTheDocument();
  });
});
