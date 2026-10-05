import { render, screen } from "@testing-library/react";

import { PerfilPage } from "./perfil.page";

describe("PerfilPage", () => {
  it("mostra nome, e-mail, papel e Setor do usuário e o formulário de troca de senha", () => {
    render(
      <PerfilPage
        header={<header>Cabeçalho</header>}
        nome="Jéssica Souza"
        email="jessica@rigonicontabil.local"
        papel="lider_setor"
        setor="simples_nacional"
        formulario={<form aria-label="Trocar senha" />}
      />,
    );

    expect(screen.getByRole("heading", { name: "Meu perfil" })).toBeInTheDocument();
    expect(screen.getByText("Jéssica Souza")).toBeInTheDocument();
    expect(screen.getByText("jessica@rigonicontabil.local")).toBeInTheDocument();
    expect(screen.getByText("Líder de setor")).toBeInTheDocument();
    expect(screen.getByText("Simples Nacional")).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Trocar senha" })).toBeInTheDocument();
  });

  it("Admin vê 'Todos os setores' em vez do Setor interno", () => {
    render(
      <PerfilPage
        header={<header>Cabeçalho</header>}
        nome="Cledson"
        email="admin@rigonicontabil.local"
        papel="admin"
        setor="administrativo"
        formulario={<form aria-label="Trocar senha" />}
      />,
    );

    expect(screen.getByText("Todos os setores")).toBeInTheDocument();
    expect(screen.queryByText("Administrativo")).not.toBeInTheDocument();
  });
});
