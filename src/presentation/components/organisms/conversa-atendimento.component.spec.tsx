import { render, screen, within } from "@testing-library/react";
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
    { valor: "contrato", rotulo: "Contrato social", grupo: "contrato" as const },
    {
      valor: "alteracao:2026-03-01",
      rotulo: "Alteração de 01/03/2026",
      grupo: "alteracao" as const,
    },
  ],
  onEnviarServico: jest.fn(),
  enviando: false,
  setoresDestino: [
    { valor: "recepcao", rotulo: "Recepção" },
    { valor: "tributario", rotulo: "Tributário" },
  ],
  onTransferir: jest.fn(),
  transferindo: false,
  onEnviarMensagem: jest.fn(),
  enviandoMensagem: false,
  mensagensEnviadas: 0,
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

  it("um clique no contrato dispara o envio dele", async () => {
    const aoEnviar = jest.fn();
    const usuario = userEvent.setup();
    render(<ConversaAtendimento {...BASE} onEnviarServico={aoEnviar} />);

    await usuario.click(screen.getByRole("button", { name: "Contrato social" }));

    expect(aoEnviar).toHaveBeenCalledWith("contrato");
  });

  it("a alteração contratual é escolhida num seletor e enviada pelo botão", async () => {
    const aoEnviar = jest.fn();
    const usuario = userEvent.setup();
    render(<ConversaAtendimento {...BASE} onEnviarServico={aoEnviar} />);

    await usuario.selectOptions(
      screen.getByLabelText("Alteração contratual"),
      "alteracao:2026-03-01",
    );
    await usuario.click(screen.getByRole("button", { name: "Enviar alteração" }));

    expect(aoEnviar).toHaveBeenCalledWith("alteracao:2026-03-01");
  });

  it("várias alterações aparecem no seletor, da mais recente para a mais antiga", () => {
    render(
      <ConversaAtendimento
        {...BASE}
        servicos={[
          ...BASE.servicos,
          { valor: "alteracao:2025-01-10", rotulo: "Alteração de 10/01/2025", grupo: "alteracao" },
        ]}
      />,
    );

    const opcoes = within(screen.getByLabelText("Alteração contratual")).getAllByRole("option");
    expect(opcoes.map((o) => o.textContent)).toEqual([
      "Escolha a alteração",
      "Alteração de 01/03/2026",
      "Alteração de 10/01/2025",
    ]);
  });

  it("guia de imposto, de parcelamento e CND aparecem desabilitados enquanto a URA não os tem", () => {
    render(<ConversaAtendimento {...BASE} />);

    for (const nome of [/Guia de imposto/, /Guia de parcelamento/, /CND/]) {
      expect(screen.getByRole("button", { name: nome })).toBeDisabled();
    }
  });

  it("Cliente sem contrato ou sem alterações mostra tudo desabilitado", () => {
    render(<ConversaAtendimento {...BASE} servicos={[]} />);

    expect(screen.getByRole("button", { name: "Contrato social" })).toBeDisabled();
    expect(screen.getByLabelText("Alteração contratual")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Enviar alteração" })).toBeDisabled();
  });

  it("enquanto envia, os serviços ficam travados", () => {
    render(<ConversaAtendimento {...BASE} enviando />);

    expect(screen.getByRole("button", { name: "Contrato social" })).toBeDisabled();
    expect(screen.getByText("Enviando...")).toBeInTheDocument();
  });

  it("sem Cliente vinculado explica por que não há o que enviar", () => {
    render(<ConversaAtendimento {...BASE} semCliente servicos={[]} />);

    expect(screen.getByText(/Sem Cliente vinculado/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Contrato social" })).not.toBeInTheDocument();
  });

  it("Atendimento encerrado não oferece envio", () => {
    render(<ConversaAtendimento {...BASE} encerrado />);

    expect(screen.getByText("Atendimento encerrado.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Contrato social" })).not.toBeInTheDocument();
  });

  it("mostra o erro do envio como alerta", () => {
    render(<ConversaAtendimento {...BASE} aviso={{ tipo: "erro", texto: "Falha ao enviar" }} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Falha ao enviar");
  });

  it("as ações ficam num painel lateral, separado do chat", () => {
    render(<ConversaAtendimento {...BASE} />);

    const painel = screen.getByRole("complementary", { name: "Ações do Atendimento" });
    expect(painel).toHaveTextContent("Serviços do cliente");
    expect(painel).toHaveTextContent("Transferir Atendimento");
    expect(painel).not.toContainElement(screen.getByText("oi"));
  });

  it("transferir envia o Setor escolhido e o resumo", async () => {
    const aoTransferir = jest.fn();
    const usuario = userEvent.setup();
    render(<ConversaAtendimento {...BASE} onTransferir={aoTransferir} />);

    const setores = screen.getByLabelText("Setor de destino");
    expect(
      within(setores)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Escolha o Setor", "Recepção", "Tributário"]);
    await usuario.selectOptions(setores, "recepcao");
    await usuario.type(screen.getByLabelText("Resumo do assunto"), "Cliente novo");
    await usuario.click(screen.getByRole("button", { name: "Transferir" }));

    expect(aoTransferir).toHaveBeenCalledWith("recepcao", "Cliente novo");
  });

  it("depois de transferido o painel avisa para onde foi e some com as ações", () => {
    render(<ConversaAtendimento {...BASE} transferidoPara="Tributário" />);

    expect(screen.getByText(/Foi para o Setor Tributário/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Transferir" })).not.toBeInTheDocument();
  });

  it("mostra o erro da transferência", () => {
    render(
      <ConversaAtendimento
        {...BASE}
        avisoTransferencia={{ tipo: "erro", texto: "Só Cliente do Simples Nacional ou MEI." }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Só Cliente do Simples Nacional");
  });

  it("Enter envia a mensagem e Shift+Enter só quebra a linha", async () => {
    const aoEnviarMensagem = jest.fn();
    const usuario = userEvent.setup();
    render(<ConversaAtendimento {...BASE} onEnviarMensagem={aoEnviarMensagem} />);

    const campo = screen.getByLabelText("Mensagem ao cliente");
    await usuario.type(campo, "Bom dia{Shift>}{Enter}{/Shift}Tudo bem?");
    expect(aoEnviarMensagem).not.toHaveBeenCalled();
    await usuario.type(campo, "{Enter}");

    expect(aoEnviarMensagem).toHaveBeenCalledWith("Bom dia\nTudo bem?");
  });

  it("o botão enviar também envia e mostra o erro do envio", async () => {
    const aoEnviarMensagem = jest.fn();
    const usuario = userEvent.setup();
    render(
      <ConversaAtendimento
        {...BASE}
        onEnviarMensagem={aoEnviarMensagem}
        erroMensagem="Falha ao enviar a mensagem."
      />,
    );

    await usuario.type(screen.getByLabelText("Mensagem ao cliente"), "Oi");
    await usuario.click(screen.getByRole("button", { name: "Enviar mensagem" }));

    expect(aoEnviarMensagem).toHaveBeenCalledWith("Oi");
    expect(screen.getByRole("alert")).toHaveTextContent("Falha ao enviar a mensagem.");
  });

  it("sem campo de resposta quando encerrado ou já transferido", () => {
    const { rerender } = render(<ConversaAtendimento {...BASE} encerrado />);
    expect(screen.queryByLabelText("Mensagem ao cliente")).not.toBeInTheDocument();

    rerender(<ConversaAtendimento {...BASE} transferidoPara="Tributário" />);
    expect(screen.queryByLabelText("Mensagem ao cliente")).not.toBeInTheDocument();
  });
});
