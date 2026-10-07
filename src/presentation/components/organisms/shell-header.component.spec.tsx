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

    expect(screen.getByText(/Setor: Simples Nacional/)).toBeInTheDocument();
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

  it("Admin vê 'Cadastrar Líder' apontando pro cadastro de usuário", () => {
    render(
      <ShellHeader
        nome="Cledson"
        papel="admin"
        setor="administrativo"
        sair={<button>Sair</button>}
      />,
    );

    expect(screen.getByRole("link", { name: /cadastrar líder/i })).toHaveAttribute(
      "href",
      "/admin/usuarios/novo",
    );
  });

  it("Líder vê 'Cadastrar Funcionário' apontando pro mesmo cadastro (já escopado no #32)", () => {
    render(
      <ShellHeader
        nome="Jéssica"
        papel="lider_setor"
        setor="contabil"
        sair={<button>Sair</button>}
      />,
    );

    expect(screen.getByRole("link", { name: /cadastrar funcionário/i })).toHaveAttribute(
      "href",
      "/admin/usuarios/novo",
    );
  });

  it("Admin vê 'Cadastrar Cliente' apontando pro cadastro de cliente", () => {
    render(
      <ShellHeader
        nome="Cledson"
        papel="admin"
        setor="administrativo"
        sair={<button>Sair</button>}
      />,
    );

    expect(screen.getByRole("link", { name: /cadastrar cliente/i })).toHaveAttribute(
      "href",
      "/admin/clientes/novo",
    );
  });

  it("Líder e Funcionário não veem 'Cadastrar Cliente' (só Admin, #33)", () => {
    render(
      <ShellHeader
        nome="Jéssica"
        papel="lider_setor"
        setor="contabil"
        sair={<button>Sair</button>}
      />,
    );

    expect(screen.queryByRole("link", { name: /cadastrar cliente/i })).not.toBeInTheDocument();
  });

  it("Funcionário não vê link de cadastro (não cadastra ninguém)", () => {
    render(
      <ShellHeader
        nome="Jéssica"
        papel="funcionario"
        setor="simples_nacional"
        sair={<button>Sair</button>}
      />,
    );

    expect(screen.queryByRole("link", { name: /cadastrar/i })).not.toBeInTheDocument();
  });
});
