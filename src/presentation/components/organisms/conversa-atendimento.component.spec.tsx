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

  it("uma alteração só é enviada direto, como no menu da URA", async () => {
    const aoEnviar = jest.fn();
    const usuario = userEvent.setup();
    render(<ConversaAtendimento {...BASE} onEnviarServico={aoEnviar} />);

    await usuario.click(screen.getByRole("button", { name: "Alteração de 01/03/2026" }));

    expect(aoEnviar).toHaveBeenCalledWith("alteracao:2026-03-01");
  });

  it("várias alterações abrem uma lista para o Funcionário escolher qual enviar", async () => {
    const aoEnviar = jest.fn();
    const usuario = userEvent.setup();
    render(
      <ConversaAtendimento
        {...BASE}
        servicos={[
          ...BASE.servicos,
          { valor: "alteracao:2025-01-10", rotulo: "Alteração de 10/01/2025", grupo: "alteracao" },
        ]}
        onEnviarServico={aoEnviar}
      />,
    );

    await usuario.click(screen.getByText(/Alterações contratuais \(2\)/));
    await usuario.click(screen.getByRole("button", { name: "Alteração de 10/01/2025" }));

    expect(aoEnviar).toHaveBeenCalledWith("alteracao:2025-01-10");
  });

  it("guia de imposto, de parcelamento e CND aparecem desabilitados enquanto a URA não os tem", () => {
    render(<ConversaAtendimento {...BASE} />);

    for (const nome of [/Guia de imposto/, /Guia de parcelamento/, /CND/]) {
      expect(screen.getByRole("button", { name: nome })).toBeDisabled();
    }
  });

  it("Cliente sem contrato ou sem alterações mostra o botão desabilitado", () => {
    render(<ConversaAtendimento {...BASE} servicos={[]} />);

    expect(screen.getByRole("button", { name: /Contrato social/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Alterações/ })).toBeDisabled();
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
});
