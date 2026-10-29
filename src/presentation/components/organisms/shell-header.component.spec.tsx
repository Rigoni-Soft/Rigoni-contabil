import { render, screen } from "@testing-library/react";

import { ShellHeader } from "./shell-header.component";

describe("ShellHeader", () => {
  it("mostra 'acesso a todos os setores' para Admin, sem citar um setor específico", () => {
    render(
      <ShellHeader
        nome="Cledson"
        papel="admin"
        setor="administrativo"
        avisos={<button>Avisos</button>}
        sair={<button>Sair</button>}
      />,
    );

    expect(screen.getByText(/acesso a todos os setores/)).toBeInTheDocument();
  });

  it("Admin não vê o sino de avisos; Líder e Funcionário veem", () => {
    const props = { nome: "N", setor: "simples_nacional", sair: <button>Sair</button> };
    const { rerender } = render(
      <ShellHeader {...props} papel="admin" avisos={<button>Avisos</button>} />,
    );
    expect(screen.queryByRole("button", { name: "Avisos" })).not.toBeInTheDocument();

    for (const papel of ["lider_setor", "funcionario"]) {
      rerender(<ShellHeader {...props} papel={papel} avisos={<button>Avisos</button>} />);
      expect(screen.getByRole("button", { name: "Avisos" })).toBeInTheDocument();
    }
  });

  it("mostra o Setor para Funcionário", () => {
    render(
      <ShellHeader
        nome="Jéssica"
        papel="funcionario"
        setor="simples_nacional"
        avisos={<button>Avisos</button>}
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
        avisos={<button>Avisos</button>}
        sair={<button>Sair</button>}
      />,
    );

    expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument();
  });

  it("tem um link pro perfil (único caminho de navegação até a troca voluntária de senha)", () => {
    render(
      <ShellHeader
        nome="Jéssica"
        papel="funcionario"
        setor="simples_nacional"
        avisos={<button>Avisos</button>}
        sair={<button>Sair</button>}
      />,
    );

    expect(screen.getByRole("link", { name: /meu perfil/i })).toHaveAttribute("href", "/perfil");
    expect(screen.queryByRole("link", { name: /trocar senha/i })).not.toBeInTheDocument();
  });

  it("Admin vê 'Cadastrar Líder' apontando pro cadastro de usuário", () => {
    render(
      <ShellHeader
        nome="Cledson"
        papel="admin"
        setor="administrativo"
        avisos={<button>Avisos</button>}
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
        avisos={<button>Avisos</button>}
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
        avisos={<button>Avisos</button>}
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
        avisos={<button>Avisos</button>}
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
        avisos={<button>Avisos</button>}
        sair={<button>Sair</button>}
      />,
    );

    expect(screen.queryByRole("link", { name: /cadastrar/i })).not.toBeInTheDocument();
  });

  it("Admin vê o link 'Usuários' (desativação, #58); Líder não", () => {
    const { rerender } = render(
      <ShellHeader
        nome="C"
        papel="admin"
        setor="administrativo"
        avisos={null}
        sair={<button>Sair</button>}
      />,
    );
    expect(screen.getByRole("link", { name: "Usuários" })).toHaveAttribute(
      "href",
      "/admin/usuarios",
    );

    rerender(
      <ShellHeader
        nome="L"
        papel="lider_setor"
        setor="contabil"
        avisos={null}
        sair={<button>Sair</button>}
      />,
    );
    expect(screen.queryByRole("link", { name: "Usuários" })).not.toBeInTheDocument();
  });

  it("nenhum papel tem o botão 'Fila' no cabeçalho (virou a aba 'Atendimento')", () => {
    const { rerender } = render(
      <ShellHeader
        nome="C"
        papel="admin"
        setor="administrativo"
        avisos={null}
        sair={<button>Sair</button>}
      />,
    );
    expect(screen.queryByRole("link", { name: "Fila" })).not.toBeInTheDocument();

    for (const papel of ["lider_setor", "funcionario"]) {
      rerender(
        <ShellHeader
          nome="L"
          papel={papel}
          setor="contabil"
          avisos={null}
          sair={<button>Sair</button>}
        />,
      );
      expect(screen.queryByRole("link", { name: "Fila" })).not.toBeInTheDocument();
    }
  });

  describe("menu do celular", () => {
    const base = {
      nome: "Jéssica",
      setor: "contabil",
      avisos: <button>Avisos</button>,
      sair: <button>Sair</button>,
    };

    it("o botão Menu aponta para o painel que reúne as ações (popover nativo)", () => {
      render(<ShellHeader {...base} papel="funcionario" />);

      const botao = screen.getByRole("button", { name: "Menu" });
      const painel = document.getElementById(botao.getAttribute("popovertarget") ?? "");
      expect(painel).toHaveAttribute("popover", "auto");
      expect(painel).toContainElement(screen.getByRole("link", { name: "Meu perfil" }));
      expect(painel).toContainElement(screen.getByRole("button", { name: "Sair" }));
    });

    it("o sino fica fora do menu, sempre à vista", () => {
      render(<ShellHeader {...base} papel="funcionario" />);

      const botao = screen.getByRole("button", { name: "Menu" });
      const painel = document.getElementById(botao.getAttribute("popovertarget") ?? "");
      expect(painel).not.toContainElement(screen.getByRole("button", { name: "Avisos" }));
    });

    it("as ações por Papel moram no menu: Admin tem as do Admin, Líder cadastra Funcionário", () => {
      const { rerender } = render(<ShellHeader {...base} papel="admin" />);
      for (const nome of ["Cadastrar Líder", "Cadastrar Cliente", "Usuários", "Feriados"]) {
        expect(screen.getByRole("link", { name: nome })).toBeInTheDocument();
      }

      rerender(<ShellHeader {...base} papel="lider_setor" />);
      expect(screen.getByRole("link", { name: "Cadastrar Funcionário" })).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Feriados" })).not.toBeInTheDocument();

      rerender(<ShellHeader {...base} papel="funcionario" />);
      expect(screen.queryByRole("link", { name: /Cadastrar/ })).not.toBeInTheDocument();
    });
  });
});
