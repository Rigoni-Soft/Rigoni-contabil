import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ConversaAtendimento } from "./conversa-atendimento.component";

const BASE = {
  titulo: "Maria",
  subtitulo: "Padaria Ltda · 11.444.777/0001-61 · (61) 98888-7777",
  encerrado: false,
  semCliente: false,
  mensagens: [
    {
      id: "1",
      lado: "contato" as const,
      autor: "Maria",
      detalhe: "CNPJ 11.444.777/0001-61",
      texto: "oi",
      hora: "08/10 12:30",
    },
    {
      id: "2",
      lado: "atendente" as const,
      autor: "Ana · Contábil",
      detalhe: null,
      texto: "Bom dia",
      hora: "08/10 12:31",
    },
  ],
  servicos: [
    { valor: "contrato", rotulo: "Contrato social" },
    { valor: "alteracao:2026-03-01", rotulo: "Alteração de 01/03/2026" },
  ],
  servicoEscolhido: "contrato",
  onEscolherServico: jest.fn(),
  onEnviarServico: jest.fn(),
  enviando: false,
};

describe("ConversaAtendimento", () => {
  it("mostra o contato no cabeçalho e, em cada balão, quem escreveu e a hora", () => {
    render(<ConversaAtendimento {...BASE} />);

    expect(screen.getByRole("heading", { name: "Maria" })).toBeInTheDocument();
    const doCliente = screen.getByText("oi").closest("li")!;
    expect(doCliente).toHaveTextContent("Maria");
    expect(doCliente).toHaveTextContent("CNPJ 11.444.777/0001-61");
    expect(doCliente).toHaveTextContent("08/10 12:30");
    const doAtendente = screen.getByText("Bom dia").closest("li")!;
    expect(doAtendente).toHaveTextContent("Ana · Contábil");
    expect(doAtendente).not.toHaveTextContent("CNPJ");
  });

  it("cliente à esquerda e atendente à direita, como nos chats", () => {
    render(<ConversaAtendimento {...BASE} />);

    expect(screen.getByText("oi").closest("li")).toHaveClass("self-start");
    expect(screen.getByText("Bom dia").closest("li")).toHaveClass("self-end");
  });

  it("escolher outro documento e enviar chama os callbacks", async () => {
    const aoEscolher = jest.fn();
    const aoEnviar = jest.fn();
    const usuario = userEvent.setup();
    render(
      <ConversaAtendimento {...BASE} onEscolherServico={aoEscolher} onEnviarServico={aoEnviar} />,
    );

    await usuario.selectOptions(screen.getByLabelText("Documento"), "alteracao:2026-03-01");
    await usuario.click(screen.getByRole("button", { name: "Enviar" }));

    expect(aoEscolher).toHaveBeenCalledWith("alteracao:2026-03-01");
    expect(aoEnviar).toHaveBeenCalledTimes(1);
  });

  it("sem Cliente vinculado explica por que não há o que enviar", () => {
    render(<ConversaAtendimento {...BASE} semCliente servicos={[]} />);

    expect(screen.getByText(/Sem Cliente vinculado/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enviar" })).not.toBeInTheDocument();
  });

  it("Atendimento encerrado não oferece envio", () => {
    render(<ConversaAtendimento {...BASE} encerrado />);

    expect(screen.getByText("Atendimento encerrado.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enviar" })).not.toBeInTheDocument();
  });

  it("mostra o erro do envio como alerta", () => {
    render(<ConversaAtendimento {...BASE} aviso={{ tipo: "erro", texto: "Falha ao enviar" }} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Falha ao enviar");
  });
});
