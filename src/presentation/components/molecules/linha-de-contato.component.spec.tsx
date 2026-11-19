import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LinhaDeContato } from "./linha-de-contato.component";

const CAMPOS = { nome: {}, telefone: {}, email: {} };

describe("LinhaDeContato", () => {
  it("linha nova mostra Salvar e Limpar, que chamam os callbacks, e não a lixeira", async () => {
    const aoSalvar = jest.fn();
    const aoLimpar = jest.fn();
    const usuario = userEvent.setup();
    render(
      <LinhaDeContato
        indice={1}
        {...CAMPOS}
        onSalvar={aoSalvar}
        onLimpar={aoLimpar}
        onRemover={jest.fn()}
      />,
    );

    await usuario.click(screen.getByRole("button", { name: "Salvar contato 2" }));
    await usuario.click(screen.getByRole("button", { name: "Limpar contato 2" }));

    expect(aoSalvar).toHaveBeenCalledTimes(1);
    expect(aoLimpar).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /Remover contato/ })).not.toBeInTheDocument();
  });

  it("os botões de ícone têm title igual ao nome acessível", () => {
    render(<LinhaDeContato indice={0} {...CAMPOS} onSalvar={jest.fn()} onLimpar={jest.fn()} />);

    expect(screen.getByRole("button", { name: "Salvar contato 1" })).toHaveAttribute(
      "title",
      "Salvar contato 1",
    );
    expect(screen.getByRole("button", { name: "Limpar contato 1" })).toHaveAttribute(
      "title",
      "Limpar contato 1",
    );
  });

  it("linha salva mostra só a lixeira", async () => {
    const aoRemover = jest.fn();
    render(
      <LinhaDeContato
        indice={0}
        {...CAMPOS}
        salvo
        onSalvar={jest.fn()}
        onLimpar={jest.fn()}
        onRemover={aoRemover}
      />,
    );

    await userEvent.setup().click(screen.getByRole("button", { name: "Remover contato 1" }));

    expect(aoRemover).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /Salvar contato/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Limpar contato/ })).not.toBeInTheDocument();
  });

  it("somente leitura não mostra nenhuma ação e não marca Nome como obrigatório", () => {
    render(
      <LinhaDeContato
        indice={0}
        {...CAMPOS}
        somenteLeitura
        onSalvar={jest.fn()}
        onLimpar={jest.fn()}
      />,
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).not.toBeRequired();
  });

  it("salvando, os botões ficam aria-disabled (sem perder o foco), não agem e o Salvar fica ocupado", async () => {
    const aoSalvar = jest.fn();
    const aoLimpar = jest.fn();
    render(
      <LinhaDeContato indice={0} {...CAMPOS} salvando onSalvar={aoSalvar} onLimpar={aoLimpar} />,
    );

    const salvar = screen.getByRole("button", { name: "Salvar contato 1" });
    const limpar = screen.getByRole("button", { name: "Limpar contato 1" });
    expect(salvar).toHaveAttribute("aria-disabled", "true");
    expect(salvar).not.toBeDisabled();
    expect(salvar).toHaveAttribute("aria-busy", "true");
    expect(limpar).toHaveAttribute("aria-disabled", "true");

    salvar.click();
    limpar.click();
    expect(aoSalvar).not.toHaveBeenCalled();
    expect(aoLimpar).not.toHaveBeenCalled();
  });

  it("a falta dos dois canais marca o E-mail como inválido e aponta a mensagem do Telefone", () => {
    render(<LinhaDeContato indice={0} {...CAMPOS} erroTelefone="Informe o WhatsApp ou o e-mail" />);

    const email = screen.getByLabelText("E-mail");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAttribute("aria-describedby", "contatos.0.telefone-mensagem");
  });

  it("erro do servidor aparece sob a linha e é ligado ao grupo", () => {
    render(<LinhaDeContato indice={0} {...CAMPOS} erroDaLinha="Este Cliente já tem o contato." />);

    expect(screen.getByRole("alert")).toHaveTextContent("Este Cliente já tem o contato.");
    expect(screen.getByRole("group", { name: "Contato 1" })).toHaveAttribute(
      "aria-describedby",
      "contatos.0.linha-mensagem",
    );
  });

  it("os botões ficam alinhados ao input, mesmo com erro de campo", () => {
    render(
      <LinhaDeContato
        indice={0}
        {...CAMPOS}
        erroNome="obrigatório"
        onSalvar={jest.fn()}
        onLimpar={jest.fn()}
      />,
    );

    const grupo = screen.getByRole("group", { name: "Contato 1" });
    expect(grupo).toHaveClass("items-start");
    expect(screen.getByRole("button", { name: "Salvar contato 1" }).parentElement).toHaveClass(
      "h-9",
    );
  });
});
