import { render, screen } from "@testing-library/react";

import { ShellHeader } from "./shell-header.component";

describe("ShellHeader", () => {
  it("mostra 'acesso a todos os setores' para Admin, sem citar um setor específico", () => {
    render(
      <ShellHeader
        nome="Cledson"
        papel="admin"
        setor="administrativo"
        sair={<button>Sair</button>}
      />,
    );

    expect(screen.getByText(/acesso a todos os setores/)).toBeInTheDocument();
  });

  it("mostra o Setor para Funcionário", () => {
    render(
      <ShellHeader
        nome="Jéssica"
        papel="funcionario"
        setor="simples_nacional"
        sair={<button>Sair</button>}
      />,
    );

    expect(screen.getByText(/Setor: simples_nacional/)).toBeInTheDocument();
    expect(screen.getByText(/Funcionário/)).toBeInTheDocument();
  });

  it("renderiza o slot de sair recebido por prop", () => {
    render(
      <ShellHeader
        nome="Jéssica"
        papel="lider_setor"
        setor="contabil"
        sair={<button>Sair</button>}
      />,
    );

    expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument();
  });

  it("tem um link pra trocar senha voluntariamente (único caminho de navegação até lá)", () => {
    render(
      <ShellHeader
        nome="Jéssica"
        papel="funcionario"
        setor="simples_nacional"
        sair={<button>Sair</button>}
      />,
    );

    expect(screen.getByRole("link", { name: /trocar senha/i })).toHaveAttribute(
      "href",
      "/trocar-senha",
    );
  });
});
