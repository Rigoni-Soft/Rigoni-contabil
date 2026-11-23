import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LinhaDeContato } from "./linha-de-contato.component";

const CAMPOS = { nome: {}, telefone: {}, email: {} };
const ENVIOS = {
  opcoes: [
    { valor: "todos", rotulo: "Todos os envios" },
    { valor: "das", rotulo: "DAS" },
  ],
  marcados: ["das"],
  onAlternar: jest.fn(),
};

describe("LinhaDeContato", () => {
  it("editando: Salvar e Cancelar chamam os callbacks, e não há Editar nem lixeira", async () => {
    const aoSalvar = jest.fn();
    const aoCancelar = jest.fn();
    const usuario = userEvent.setup();
    render(
      <LinhaDeContato
        indice={1}
        {...CAMPOS}
        editando
        salvo
        onEditar={jest.fn()}
        onSalvar={aoSalvar}
        onCancelar={aoCancelar}
        onRemover={jest.fn()}
      />,
    );

    await usuario.click(screen.getByRole("button", { name: "Salvar contato 2" }));
    await usuario.click(screen.getByRole("button", { name: "Cancelar edição do contato 2" }));

    expect(aoSalvar).toHaveBeenCalledTimes(1);
    expect(aoCancelar).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /Editar contato|Remover contato/ })).toBeNull();
  });

  it("só mostrando: Editar e lixeira, campos só de leitura, sem Salvar nem Cancelar", async () => {
    const aoEditar = jest.fn();
    const aoRemover = jest.fn();
    const usuario = userEvent.setup();
    render(
      <LinhaDeContato
        indice={0}
        {...CAMPOS}
        editando={false}
        salvo
        onEditar={aoEditar}
        onSalvar={jest.fn()}
        onCancelar={jest.fn()}
        onRemover={aoRemover}
      />,
    );

    expect(screen.getByLabelText("Nome")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("WhatsApp")).toHaveAttribute("readonly");
    expect(screen.queryByRole("button", { name: /Salvar contato|Cancelar edição/ })).toBeNull();
    await usuario.click(screen.getByRole("button", { name: "Editar contato 1" }));
    await usuario.click(screen.getByRole("button", { name: "Remover contato 1" }));

    expect(aoEditar).toHaveBeenCalledTimes(1);
    expect(aoRemover).toHaveBeenCalledTimes(1);
  });

  it("editando: os campos aceitam digitação e o Nome é obrigatório", () => {
    render(
      <LinhaDeContato
        indice={0}
        {...CAMPOS}
        editando
        onSalvar={jest.fn()}
        onCancelar={jest.fn()}
      />,
    );

    expect(screen.getByLabelText(/^Nome/)).not.toHaveAttribute("readonly");
    expect(screen.getByLabelText(/^Nome/)).toBeRequired();
  });

  it("contato de outro Setor: campos só de leitura mesmo editando, sem asterisco e sem lixeira", () => {
    render(
      <LinhaDeContato
        indice={0}
        {...CAMPOS}
        editando
        salvo
        camposTravados
        envios={ENVIOS}
        onSalvar={jest.fn()}
        onCancelar={jest.fn()}
      />,
    );

    expect(screen.getByLabelText("Nome")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("WhatsApp")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("E-mail")).toHaveAttribute("readonly");
    expect(screen.queryByText("*")).not.toBeInTheDocument();
    expect(screen.getByLabelText("DAS")).toBeEnabled();
    expect(screen.queryByRole("button", { name: /Remover/ })).toBeNull();
  });

  it("contato de outro Setor só mostrando: Editar, sem lixeira (o Setor só edita os envios)", () => {
    render(
      <LinhaDeContato
        indice={0}
        {...CAMPOS}
        editando={false}
        salvo
        camposTravados
        onEditar={jest.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Editar contato 1" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remover/ })).toBeNull();
  });

  it("envios: um checkbox por tipo; editando, marcar chama o callback; o aviso de canal aparece", async () => {
    const aoAlternar = jest.fn();
    const usuario = userEvent.setup();
    render(
      <LinhaDeContato
        indice={0}
        {...CAMPOS}
        editando
        envios={{ ...ENVIOS, aviso: "O contato deixou de ter o WhatsApp.", onAlternar: aoAlternar }}
      />,
    );

    expect(screen.getByRole("group", { name: "Envios do contato 1" })).toBeInTheDocument();
    expect(screen.getByLabelText("DAS")).toBeChecked();
    expect(screen.getByLabelText("Todos os envios")).not.toBeChecked();
    await usuario.click(screen.getByLabelText("Todos os envios"));

    expect(aoAlternar).toHaveBeenCalledWith("todos");
    expect(screen.getByText("O contato deixou de ter o WhatsApp.")).toBeInTheDocument();
  });

  it("envios só mostrando: o que o Setor marcou aparece em texto, sem checkbox", () => {
    render(<LinhaDeContato indice={0} {...CAMPOS} editando={false} envios={ENVIOS} />);

    const grupo = screen.getByRole("group", { name: "Envios do contato 1" });
    expect(grupo).toHaveTextContent("DAS");
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("envios só mostrando sem nada marcado: diz que não recebe nenhum envio", () => {
    render(
      <LinhaDeContato
        indice={0}
        {...CAMPOS}
        editando={false}
        envios={{ ...ENVIOS, marcados: [] }}
      />,
    );

    expect(screen.getByRole("group", { name: "Envios do contato 1" })).toHaveTextContent(
      "nenhum envio",
    );
  });

  it("deixar de usar: a pergunta tem Deixar de usar e Manter, e cada um chama o seu callback", async () => {
    const aoConfirmar = jest.fn();
    const aoManter = jest.fn();
    const usuario = userEvent.setup();
    render(
      <LinhaDeContato
        indice={0}
        {...CAMPOS}
        editando={false}
        salvo
        onEditar={jest.fn()}
        onRemover={jest.fn()}
        confirmacaoDeRemocao={{
          texto: "Deixar de usar este contato?",
          onConfirmar: aoConfirmar,
          onCancelar: aoManter,
        }}
      />,
    );

    expect(screen.getByText("Deixar de usar este contato?")).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: "Manter" }));
    await usuario.click(screen.getByRole("button", { name: "Deixar de usar" }));
    expect(aoManter).toHaveBeenCalledTimes(1);
    expect(aoConfirmar).toHaveBeenCalledTimes(1);
  });

  describe("Enviar por (contato com os dois canais)", () => {
    const CANAL = {
      opcoes: [
        { valor: "whatsapp", rotulo: "WhatsApp" },
        { valor: "email", rotulo: "E-mail" },
        { valor: "whatsapp_e_email", rotulo: "WhatsApp e E-mail" },
      ],
      valor: "",
      onMudar: jest.fn(),
    };

    it("editando: select obrigatório sem valor padrão; escolher chama o callback", async () => {
      const aoMudar = jest.fn();
      const usuario = userEvent.setup();
      render(
        <LinhaDeContato
          indice={0}
          {...CAMPOS}
          editando
          envios={{ ...ENVIOS, canal: { ...CANAL, onMudar: aoMudar } }}
        />,
      );

      const select = screen.getByLabelText(/^Enviar por/);
      expect(select).toHaveValue("");
      expect(select).toBeRequired();
      await usuario.selectOptions(select, "WhatsApp e E-mail");

      expect(aoMudar).toHaveBeenCalledWith("whatsapp_e_email");
    });

    it("o erro vai ao select (aria-invalid e descrição)", () => {
      render(
        <LinhaDeContato
          indice={0}
          {...CAMPOS}
          editando
          envios={{ ...ENVIOS, canal: { ...CANAL, erro: "Escolha por onde enviar." } }}
        />,
      );

      const select = screen.getByLabelText(/^Enviar por/);
      expect(select).toHaveAttribute("aria-invalid", "true");
      expect(select).toHaveAccessibleDescription("Escolha por onde enviar.");
    });

    it("só mostrando: o canal escolhido aparece como texto, sem select", () => {
      render(
        <LinhaDeContato
          indice={0}
          {...CAMPOS}
          editando={false}
          envios={{ ...ENVIOS, canal: { ...CANAL, valor: "email" } }}
        />,
      );

      expect(screen.getByText(/Enviar por:\s*E-mail/)).toBeInTheDocument();
      expect(screen.queryByLabelText(/^Enviar por/)).toBeNull();
    });

    it("só mostrando sem escolha (dado antigo): diz que não foi escolhido", () => {
      render(
        <LinhaDeContato
          indice={0}
          {...CAMPOS}
          editando={false}
          envios={{ ...ENVIOS, canal: CANAL }}
        />,
      );

      expect(screen.getByText(/Enviar por:\s*não escolhido/)).toBeInTheDocument();
    });

    it("contato com um canal só: sem 'Enviar por'", () => {
      render(<LinhaDeContato indice={0} {...CAMPOS} editando envios={ENVIOS} />);

      expect(screen.queryByText(/Enviar por/)).toBeNull();
    });
  });

  it("salvando: Salvar e Cancelar ficam aria-disabled (mantêm o foco) e não disparam", async () => {
    const aoSalvar = jest.fn();
    const aoCancelar = jest.fn();
    const usuario = userEvent.setup();
    render(
      <LinhaDeContato
        indice={0}
        {...CAMPOS}
        editando
        salvando
        onSalvar={aoSalvar}
        onCancelar={aoCancelar}
      />,
    );

    const salvar = screen.getByRole("button", { name: "Salvar contato 1" });
    await usuario.click(salvar);
    await usuario.click(screen.getByRole("button", { name: "Cancelar edição do contato 1" }));

    expect(salvar).toHaveAttribute("aria-disabled", "true");
    expect(salvar).toHaveAttribute("aria-busy", "true");
    expect(aoSalvar).not.toHaveBeenCalled();
    expect(aoCancelar).not.toHaveBeenCalled();
  });

  it("os botões de ícone têm title igual ao nome acessível", () => {
    render(
      <LinhaDeContato
        indice={0}
        {...CAMPOS}
        editando
        onSalvar={jest.fn()}
        onCancelar={jest.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Salvar contato 1" })).toHaveAttribute(
      "title",
      "Salvar contato 1",
    );
    expect(screen.getByRole("button", { name: "Cancelar edição do contato 1" })).toHaveAttribute(
      "title",
      "Cancelar edição do contato 1",
    );
  });

  it("visualização da tela toda: sem botões nem asterisco", () => {
    render(
      <LinhaDeContato
        indice={0}
        {...CAMPOS}
        editando={false}
        salvo
        somenteLeitura
        onEditar={jest.fn()}
        onRemover={jest.fn()}
      />,
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText("*")).not.toBeInTheDocument();
  });

  it("mostra a falha da linha e liga os erros dos campos", () => {
    render(
      <LinhaDeContato
        indice={0}
        {...CAMPOS}
        editando
        erroDaLinha="Já existe."
        erroTelefone="Informe o WhatsApp ou o e-mail"
        onSalvar={jest.fn()}
        onCancelar={jest.fn()}
      />,
    );

    expect(screen.getByText("Já existe.")).toBeInTheDocument();
    expect(screen.getByText("Informe o WhatsApp ou o e-mail")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Contato 1" })).toHaveAttribute(
      "aria-describedby",
      "contatos.0.linha-mensagem",
    );
  });

  it("número repetido: o aviso liga ao WhatsApp e 'Usar este contato' chama o callback", async () => {
    const aoUsar = jest.fn();
    const usuario = userEvent.setup();
    render(
      <LinhaDeContato
        indice={0}
        {...CAMPOS}
        editando
        numeroRepetido={{ texto: "Este número já é do contato Bia.", onUsar: aoUsar }}
        onSalvar={jest.fn()}
        onCancelar={jest.fn()}
      />,
    );

    const aviso = screen.getByText("Este número já é do contato Bia.");
    expect(aviso.closest("p")).toHaveAttribute("id", "contatos.0.telefone-repetido");
    expect(screen.getByLabelText("WhatsApp")).toHaveAttribute(
      "aria-describedby",
      "contatos.0.telefone-repetido",
    );
    await usuario.click(screen.getByRole("button", { name: "Usar este contato" }));
    expect(aoUsar).toHaveBeenCalledTimes(1);
  });

  it("número repetido de contato que já está na lista: só o aviso, sem botão", () => {
    render(
      <LinhaDeContato
        indice={0}
        {...CAMPOS}
        editando
        numeroRepetido={{ texto: "Este número já é do contato Ana, que já está na lista." }}
        onSalvar={jest.fn()}
        onCancelar={jest.fn()}
      />,
    );

    expect(screen.getByText(/que já está na lista/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Usar este contato" })).toBeNull();
  });
});
