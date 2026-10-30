import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BotaoDeEnvio } from "@/presentation/components/atoms/botao-de-envio.component";

import { AcoesDoFormulario } from "./acoes-do-formulario.component";
import { CampoDeOpcoes } from "./campo-de-opcoes.component";
import { CampoDeTexto } from "./campo-de-texto.component";
import { CampoResponsavel } from "./campo-responsavel.component";
import { ConfirmacaoDeCadastro } from "./confirmacao-de-cadastro.component";
import { LinhaDeAlteracao } from "./linha-de-alteracao.component";
import { LinhaDeContato } from "./linha-de-contato.component";

describe("CampoDeTexto", () => {
  it("rótulo ligado ao campo, obrigatório e erro marcam aria", () => {
    render(<CampoDeTexto id="cnpj" rotulo="CNPJ" obrigatorio erro="CNPJ inválido." />);

    const campo = screen.getByLabelText(/CNPJ/);
    expect(campo).toHaveAttribute("aria-required", "true");
    expect(campo).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("CNPJ inválido.");
  });

  it("a ajuda fica sob o campo e é a descrição dele", () => {
    render(<CampoDeTexto id="n" rotulo="Nº" ajuda="Pode editar." />);

    expect(screen.getByLabelText("Nº")).toHaveAccessibleDescription("Pode editar.");
  });

  it("erro e aviso são a descrição do campo, junto da ajuda e do que o chamador ligou", () => {
    const { rerender } = render(
      <CampoDeTexto
        id="n"
        rotulo="Nº"
        ajuda="Pode editar."
        aria-describedby="externo"
        erro="Obrigatório."
      />,
    );
    const campo = screen.getByLabelText("Nº");
    expect(campo).toHaveAccessibleDescription(/Obrigatório\./);
    expect(campo).toHaveAccessibleDescription(/Pode editar\./);

    rerender(<CampoDeTexto id="n" rotulo="Nº" aviso="Confira o nº." />);
    expect(screen.getByLabelText("Nº")).toHaveAccessibleDescription("Confira o nº.");
  });

  it("o aviso só aparece quando não há erro", () => {
    const { rerender } = render(<CampoDeTexto id="e" rotulo="Empresa" aviso="Confirme à mão." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Confirme à mão.");

    rerender(<CampoDeTexto id="e" rotulo="Empresa" aviso="Confirme à mão." erro="Obrigatório." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Obrigatório.");
  });
});

describe("CampoDeOpcoes", () => {
  it("o erro é a descrição do select", () => {
    render(
      <CampoDeOpcoes
        id="r"
        rotulo="Regime"
        opcoes={[{ valor: "mei", rotulo: "MEI" }]}
        erro="Escolha um regime."
      />,
    );

    expect(screen.getByLabelText("Regime")).toHaveAccessibleDescription("Escolha um regime.");
  });

  it("a ajuda é a descrição do select", () => {
    render(
      <CampoDeOpcoes
        id="r"
        rotulo="Regime"
        opcoes={[{ valor: "mei", rotulo: "MEI" }]}
        ajuda="Definido pelo sistema."
      />,
    );

    expect(screen.getByLabelText("Regime")).toHaveAccessibleDescription("Definido pelo sistema.");
  });

  it("lista as opções e usa o placeholder desabilitado", () => {
    render(
      <CampoDeOpcoes
        id="regime"
        rotulo="Regime"
        opcoes={[{ valor: "mei", rotulo: "MEI" }]}
        placeholder="Selecione"
        placeholderDesabilitado
      />,
    );

    expect(screen.getByRole("option", { name: "Selecione" })).toBeDisabled();
    expect(screen.getByRole("option", { name: "MEI" })).toBeInTheDocument();
  });
});

describe("ConfirmacaoDeCadastro e BotaoDeEnvio", () => {
  it("'Cadastrar outro' chama o callback e 'Finalizar' leva para a home", async () => {
    const aoNovo = jest.fn();
    render(
      <ConfirmacaoDeCadastro
        largura="sm"
        mensagem="Cliente cadastrado."
        onCadastrarNovo={aoNovo}
      />,
    );

    await userEvent.setup().click(screen.getByRole("button", { name: "Cadastrar outro" }));

    expect(aoNovo).toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Finalizar" })).toHaveAttribute("href", "/");
  });

  it("o botão de envio trava com o rótulo de pendente", () => {
    render(<BotaoDeEnvio pendente rotulo="Cadastrar" rotuloPendente="Cadastrando…" />);

    expect(screen.getByRole("button", { name: "Cadastrando…" })).toBeDisabled();
  });
});

describe("linhas de lista do formulário", () => {
  it("LinhaDeContato numera a remoção e liga os rótulos pelo índice", async () => {
    const aoRemover = jest.fn();
    render(
      <LinhaDeContato
        indice={1}
        nome={{}}
        telefone={{}}
        padrao={{}}
        erroTelefone="Telefone inválido."
        onRemover={aoRemover}
      />,
    );

    expect(screen.getByLabelText(/Nome/)).toHaveAttribute("id", "contatos.1.nome");
    expect(screen.getByRole("alert")).toHaveTextContent("Telefone inválido.");
    await userEvent.setup().click(screen.getByRole("button", { name: "Remover contato 2" }));
    expect(aoRemover).toHaveBeenCalled();
  });

  it("LinhaDeAlteracao entrega o id do arquivo ao campo e mostra os erros", () => {
    render(
      <LinhaDeAlteracao
        indice={0}
        numero={{}}
        erroNumero="Já existe a alteração nº 1"
        data={{}}
        erroData="Informe a data."
        erroArquivo="Envie o arquivo."
        arquivo={<input id="alteracoesContratuais.0.arquivo" type="file" />}
        onRemover={jest.fn()}
      />,
    );

    expect(screen.getByLabelText("Arquivo da alteração 1")).toHaveAttribute(
      "id",
      "alteracoesContratuais.0.arquivo",
    );
    expect(screen.getByLabelText("Nº da alteração 1")).toHaveAttribute("type", "number");
    expect(screen.getByLabelText("Nº da alteração 1")).toHaveAccessibleDescription(
      /Sugerido pelo início do nome do arquivo.*Já existe a alteração nº 1/,
    );
    expect(screen.getByLabelText("Data da alteração 1")).toHaveAccessibleDescription(
      "Informe a data.",
    );
    expect(screen.getAllByRole("alert").map((a) => a.textContent)).toEqual([
      "Já existe a alteração nº 1",
      "Informe a data.",
      "Envie o arquivo.",
    ]);
  });
});

describe("CampoResponsavel e AcoesDoFormulario", () => {
  const base = {
    nomeAtual: "Ana",
    opcoes: [{ id: "u1", nome: "Bia" }],
    semResponsavel: "Sem responsável",
    onAbrir: jest.fn(),
    onTentarNovamente: jest.fn(),
    select: {},
  };

  it("não editável mostra só o nome; editável abre a lista no foco", async () => {
    const aoAbrir = jest.fn();
    const { rerender } = render(<CampoResponsavel {...base} editavel={false} estadoLista="ok" />);
    expect(screen.getByLabelText("Responsável")).toHaveValue("Ana");

    rerender(<CampoResponsavel {...base} editavel estadoLista="ok" onAbrir={aoAbrir} />);
    await userEvent.setup().click(screen.getByRole("combobox", { name: "Responsável" }));
    expect(aoAbrir).toHaveBeenCalled();
  });

  it("erro na lista oferece 'Tentar de novo'", async () => {
    const aoTentar = jest.fn();
    render(<CampoResponsavel {...base} editavel estadoLista="erro" onTentarNovamente={aoTentar} />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(aoTentar).toHaveBeenCalled();
  });

  it("Cancelar vira link para '/' sem callback e botão com callback", async () => {
    const aoCancelar = jest.fn();
    const { rerender } = render(<AcoesDoFormulario pendente={false} onLimpar={jest.fn()} />);
    expect(screen.getByRole("link", { name: "Cancelar" })).toHaveAttribute("href", "/");

    rerender(<AcoesDoFormulario pendente={false} onLimpar={jest.fn()} onCancelar={aoCancelar} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Cancelar" }));
    expect(aoCancelar).toHaveBeenCalled();
  });
});
