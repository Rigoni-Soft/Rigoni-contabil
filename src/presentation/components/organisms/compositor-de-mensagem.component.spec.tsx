import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CompositorDeMensagem } from "./compositor-de-mensagem.component";

const SELETOR = {
  aberto: false,
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

  it("fechado, não mostra os emojis", () => {
    render(<CompositorDeMensagem {...BASE} />);

    expect(screen.queryByRole("group", { name: "Emojis" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Inserir emoji" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
});
