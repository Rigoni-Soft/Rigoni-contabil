import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CompositorDeMensagem } from "./compositor-de-mensagem.component";

const SELETOR = {
  aberto: false,
  recentes: [] as string[],
  completo: false,
  onExpandir: jest.fn(),
  onAlternar: jest.fn(),
  onEscolher: jest.fn(),
  painelId: "painel",
  raizRef: null,
  botaoRef: null,
};
const BASE = {
  onEnviar: jest.fn(),
  enviando: false,
  enviadas: 0,
  campoRef: null,
  seletor: SELETOR,
  aceitar: "image/png,application/pdf",
  onAnexar: jest.fn(),
  onRemoverAnexo: jest.fn(),
};

describe("CompositorDeMensagem", () => {
  it("Enter envia a mensagem e Shift+Enter só quebra a linha", async () => {
    const aoEnviar = jest.fn();
    const usuario = userEvent.setup();
    render(<CompositorDeMensagem {...BASE} onEnviar={aoEnviar} />);

    const campo = screen.getByLabelText("Mensagem ao cliente");
    await usuario.type(campo, "Bom dia{Shift>}{Enter}{/Shift}Tudo bem?");
    expect(aoEnviar).not.toHaveBeenCalled();
    await usuario.type(campo, "{Enter}");

    expect(aoEnviar).toHaveBeenCalledWith("Bom dia\nTudo bem?");
  });

  it("Enter que confirma composição (IME, keyCode 229) não envia", async () => {
    const aoEnviar = jest.fn();
    const usuario = userEvent.setup();
    render(<CompositorDeMensagem {...BASE} onEnviar={aoEnviar} />);

    const campo = screen.getByLabelText("Mensagem ao cliente");
    await usuario.type(campo, "ola");
    fireEvent.keyDown(campo, { key: "Enter", isComposing: true });
    fireEvent.keyDown(campo, { key: "Enter", keyCode: 229 });

    expect(aoEnviar).not.toHaveBeenCalled();
  });

  it("o botão enviar também envia, e o erro do envio aparece como alerta", async () => {
    const aoEnviar = jest.fn();
    const usuario = userEvent.setup();
    render(
      <CompositorDeMensagem {...BASE} onEnviar={aoEnviar} erro="Falha ao enviar a mensagem." />,
    );

    await usuario.type(screen.getByLabelText("Mensagem ao cliente"), "Oi");
    await usuario.click(screen.getByRole("button", { name: "Enviar mensagem" }));

    expect(aoEnviar).toHaveBeenCalledWith("Oi");
    expect(screen.getByRole("alert")).toHaveTextContent("Falha ao enviar a mensagem.");
  });

  it("trava o botão enquanto envia", () => {
    render(<CompositorDeMensagem {...BASE} enviando />);

    expect(screen.getByRole("button", { name: "Enviar mensagem" })).toBeDisabled();
  });

  it("esvazia o campo quando um envio dá certo (enviadas muda)", async () => {
    const usuario = userEvent.setup();
    const { rerender } = render(<CompositorDeMensagem {...BASE} />);
    await usuario.type(screen.getByLabelText("Mensagem ao cliente"), "Oi");

    rerender(<CompositorDeMensagem {...BASE} enviadas={1} />);

    expect(screen.getByLabelText("Mensagem ao cliente")).toHaveValue("");
  });
});

describe("CompositorDeMensagem — seletor de emoji", () => {
  it("o botão alterna o seletor e cada emoji escolhido é repassado", async () => {
    const aoAlternar = jest.fn();
    const aoEscolher = jest.fn();
    const usuario = userEvent.setup();
    const seletor = { ...SELETOR, aberto: true, onAlternar: aoAlternar, onEscolher: aoEscolher };
    render(<CompositorDeMensagem {...BASE} seletor={seletor} />);

    for (const nome of ["Rostos", "Gestos", "Objetos", "Símbolos"]) {
      expect(screen.getByRole("group", { name: nome })).toBeInTheDocument();
    }
    await usuario.click(screen.getByRole("button", { name: "Joinha" }));
    await usuario.click(screen.getByRole("button", { name: "Inserir emoji" }));

    expect(aoEscolher).toHaveBeenCalledWith("👍");
    expect(aoAlternar).toHaveBeenCalled();
  });

  it("com recentes mostra só a linha deles e o ver todos; completo traz as categorias", async () => {
    const aoExpandir = jest.fn();
    const usuario = userEvent.setup();
    const seletor = { ...SELETOR, aberto: true, recentes: ["👍"], onExpandir: aoExpandir };
    const { rerender } = render(<CompositorDeMensagem {...BASE} seletor={seletor} />);

    expect(screen.getByRole("group", { name: "Recentes" })).toHaveTextContent("👍");
    expect(screen.queryByRole("group", { name: "Rostos" })).not.toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: "Ver todos os emojis" }));
    expect(aoExpandir).toHaveBeenCalled();

    rerender(<CompositorDeMensagem {...BASE} seletor={{ ...seletor, completo: true }} />);
    expect(screen.getByRole("group", { name: "Rostos" })).toBeInTheDocument();
  });

  it("fechado, não mostra os emojis", () => {
    render(<CompositorDeMensagem {...BASE} />);

    expect(screen.queryByRole("group", { name: "Emojis" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Inserir emoji" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
});

describe("CompositorDeMensagem — anexo", () => {
  const PDF = new File(["%PDF"], "balanco.pdf", { type: "application/pdf" });
  const ANEXO = { nome: "balanco.pdf", tamanho: "1,5 KB", miniaturaUrl: null };

  it("o clipe entrega o arquivo escolhido no seletor do sistema", async () => {
    const aoAnexar = jest.fn();
    const usuario = userEvent.setup();
    render(<CompositorDeMensagem {...BASE} onAnexar={aoAnexar} />);

    await usuario.upload(screen.getByLabelText("Anexar arquivo"), PDF);

    expect(aoAnexar).toHaveBeenCalledWith(PDF);
  });

  it("arrastando, o campo é destacado e os eventos de arrastar vão ao Container", () => {
    const onDrop = jest.fn();
    render(<CompositorDeMensagem {...BASE} arraste={{ arrastando: true, ligacoes: { onDrop } }} />);
    const form = screen.getByLabelText("Mensagem ao cliente").closest("form")!;

    expect(form.className).toMatch(/ring-primary/);
    fireEvent.drop(form);
    expect(onDrop).toHaveBeenCalled();
  });

  it("colar uma imagem (Ctrl+V) a anexa; colar texto não", () => {
    const aoAnexar = jest.fn();
    const imagem = new File(["x"], "print.png", { type: "image/png" });
    render(<CompositorDeMensagem {...BASE} onAnexar={aoAnexar} />);
    const campo = screen.getByLabelText("Mensagem ao cliente");

    fireEvent.paste(campo, { clipboardData: { files: [imagem] } });
    expect(aoAnexar).toHaveBeenCalledWith(imagem);

    aoAnexar.mockClear();
    fireEvent.paste(campo, { clipboardData: { files: [] } });
    expect(aoAnexar).not.toHaveBeenCalled();
  });

  it("mostra a prévia com nome e tamanho, e remover chama o callback", async () => {
    const aoRemover = jest.fn();
    const usuario = userEvent.setup();
    render(<CompositorDeMensagem {...BASE} anexo={ANEXO} onRemoverAnexo={aoRemover} />);

    expect(screen.getByText("balanco.pdf")).toBeInTheDocument();
    expect(screen.getByText("1,5 KB")).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: "Remover balanco.pdf" }));

    expect(aoRemover).toHaveBeenCalled();
  });

  it("com anexo o texto vira legenda opcional e o envio sai sem texto", async () => {
    const aoEnviar = jest.fn();
    const usuario = userEvent.setup();
    render(<CompositorDeMensagem {...BASE} anexo={ANEXO} onEnviar={aoEnviar} />);

    expect(screen.getByLabelText("Mensagem ao cliente")).not.toBeRequired();
    expect(screen.getByLabelText("Mensagem ao cliente")).toHaveAttribute(
      "placeholder",
      "Legenda (opcional)",
    );
    await usuario.click(screen.getByRole("button", { name: "Enviar arquivo" }));

    expect(aoEnviar).toHaveBeenCalledWith("");
  });

  it("imagem escolhida mostra a miniatura", () => {
    const { container } = render(
      <CompositorDeMensagem {...BASE} anexo={{ ...ANEXO, miniaturaUrl: "blob:abc" }} />,
    );

    expect(container.querySelector('img[src="blob:abc"]')).toBeInTheDocument();
  });

  describe("CompositorDeMensagem — enviando anexo", () => {
    it("anuncia o envio, trava remover e enviar", () => {
      render(
        <CompositorDeMensagem
          {...BASE}
          enviando
          anexo={{ nome: "balanco.pdf", tamanho: "1,5 KB", miniaturaUrl: null }}
        />,
      );

      expect(screen.getByRole("status")).toHaveTextContent("Enviando… 1,5 KB");
      expect(screen.getByRole("button", { name: "Remover balanco.pdf" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Enviar arquivo" })).toBeDisabled();
    });
  });

  describe("CompositorDeMensagem — gravação de áudio", () => {
    const GRAVACAO = {
      gravando: false,
      parada: false,
      tempo: "00:00",
      onIniciar: jest.fn(),
      onCancelar: jest.fn(),
      onEnviar: jest.fn(),
    };

    it("o microfone inicia a gravação", async () => {
      const aoIniciar = jest.fn();
      render(<CompositorDeMensagem {...BASE} gravacao={{ ...GRAVACAO, onIniciar: aoIniciar }} />);

      await userEvent.click(screen.getByRole("button", { name: "Gravar áudio" }));

      expect(aoIniciar).toHaveBeenCalled();
    });

    it("sem suporte, o microfone fica desligado e o motivo aparece, sem quebrar o campo", () => {
      render(
        <CompositorDeMensagem
          {...BASE}
          gravacao={{ ...GRAVACAO, indisponivel: "Este navegador não permite gravar áudio." }}
        />,
      );

      expect(screen.getByRole("button", { name: "Gravar áudio" })).toBeDisabled();
      expect(screen.getByText("Este navegador não permite gravar áudio.")).toBeInTheDocument();
      expect(screen.getByLabelText("Mensagem ao cliente")).toBeEnabled();
    });

    it("gravando, mostra o cronômetro e as ações cancelar e enviar no lugar do campo", async () => {
      const aoCancelar = jest.fn();
      const aoEnviar = jest.fn();
      render(
        <CompositorDeMensagem
          {...BASE}
          gravacao={{
            ...GRAVACAO,
            gravando: true,
            tempo: "01:05",
            onCancelar: aoCancelar,
            onEnviar: aoEnviar,
          }}
        />,
      );

      expect(screen.getByText("01:05")).toBeInTheDocument();
      expect(screen.queryByLabelText("Mensagem ao cliente")).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Cancelar gravação" }));
      await userEvent.click(screen.getByRole("button", { name: "Enviar áudio" }));
      expect(aoCancelar).toHaveBeenCalled();
      expect(aoEnviar).toHaveBeenCalled();
    });

    it("a barra entra com o foco em cancelar e o Esc descarta a gravação", async () => {
      const aoCancelar = jest.fn();
      render(
        <CompositorDeMensagem
          {...BASE}
          gravacao={{ ...GRAVACAO, gravando: true, onCancelar: aoCancelar }}
        />,
      );

      expect(screen.getByRole("button", { name: "Cancelar gravação" })).toHaveFocus();
      await userEvent.keyboard("{Escape}");

      expect(aoCancelar).toHaveBeenCalledTimes(1);
    });

    it("com o envio em curso, o Esc não descarta", async () => {
      const aoCancelar = jest.fn();
      render(
        <CompositorDeMensagem
          {...BASE}
          enviando
          gravacao={{ ...GRAVACAO, gravando: true, onCancelar: aoCancelar }}
        />,
      );

      screen.getByRole("button", { name: "Enviar áudio" }).focus();
      await userEvent.keyboard("{Escape}");

      expect(aoCancelar).not.toHaveBeenCalled();
    });

    it("depois de gravar, o microfone volta a ter o foco", () => {
      render(<CompositorDeMensagem {...BASE} gravacao={{ ...GRAVACAO, focarMicrofone: true }} />);

      expect(screen.getByRole("button", { name: "Gravar áudio" })).toHaveFocus();
    });

    it("gravação parada pede a confirmação e o envio em curso trava as ações", () => {
      render(
        <CompositorDeMensagem
          {...BASE}
          enviando
          gravacao={{ ...GRAVACAO, gravando: true, parada: true, tempo: "05:00" }}
        />,
      );

      expect(screen.getByText("A gravação parou. Envie o áudio ou cancele.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Enviar áudio" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Cancelar gravação" })).toBeDisabled();
    });
  });
});
