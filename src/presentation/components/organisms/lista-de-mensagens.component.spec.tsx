import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ListaDeMensagens } from "./lista-de-mensagens.component";

const MENSAGENS = [
  {
    id: "1",
    lado: "contato" as const,
    autor: "Maria",
    detalhe: null,
    texto: "primeira",
    hora: "12:30",
  },
  {
    id: "2",
    lado: "atendente" as const,
    autor: "Ana",
    detalhe: null,
    texto: "segunda",
    hora: "12:31",
  },
];

describe("ListaDeMensagens", () => {
  it("mostra um balão por mensagem", () => {
    render(<ListaDeMensagens mensagens={MENSAGENS} />);

    expect(
      within(screen.getByRole("list", { name: "Mensagens" })).getAllByRole("listitem"),
    ).toHaveLength(2);
  });

  it("fica parada nas últimas mensagens (rolador col-reverse) e o DOM segue a ordem cronológica", () => {
    render(<ListaDeMensagens mensagens={MENSAGENS} />);

    expect(screen.getByRole("log", { name: "Conversa" })).toHaveClass(
      "flex-col-reverse",
      "overflow-y-auto",
    );
    const itens = within(screen.getByRole("list", { name: "Mensagens" })).getAllByRole("listitem");
    expect(itens[0]).toHaveTextContent("primeira");
    expect(itens[1]).toHaveTextContent("segunda");
  });
});

describe("ListaDeMensagens — histórico anterior (R85-05)", () => {
  it("oferece as mensagens anteriores acima da lista e pede o carregamento", async () => {
    const aoCarregar = jest.fn();
    render(
      <ListaDeMensagens
        mensagens={MENSAGENS}
        anteriores={{ disponivel: true, carregando: false, aoCarregar }}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Ver mensagens anteriores" }));

    expect(aoCarregar).toHaveBeenCalledTimes(1);
  });

  it("sem histórico a mais não mostra o botão; carregando o desabilita; o erro aparece", () => {
    const { rerender } = render(
      <ListaDeMensagens
        mensagens={MENSAGENS}
        anteriores={{ disponivel: false, carregando: false, aoCarregar: jest.fn() }}
      />,
    );
    expect(screen.queryByRole("button", { name: /anteriores/ })).not.toBeInTheDocument();

    rerender(
      <ListaDeMensagens
        mensagens={MENSAGENS}
        anteriores={{ disponivel: true, carregando: true, erro: "Falhou.", aoCarregar: jest.fn() }}
      />,
    );
    expect(screen.getByRole("button", { name: "Carregando…" })).toBeDisabled();
    expect(screen.getByText("Falhou.")).toBeInTheDocument();
  });
});

describe("ListaDeMensagens — reação (#84)", () => {
  const REAGIVEIS = [
    { ...MENSAGENS[0], reagivel: true, reacao: "❤️" },
    { ...MENSAGENS[1], reagivel: false },
  ];
  const reacao = (extra: object = {}) => ({
    ativa: true,
    abertaId: null,
    completo: false,
    recentes: [] as string[],
    aoExpandir: jest.fn(),
    painelId: "painel",
    raizRef: null,
    botaoRef: null,
    aoAlternar: jest.fn(),
    aoEscolher: jest.fn(),
    ...extra,
  });

  it("só a Mensagem reagível ganha o botão, e a reação aparece no balão", async () => {
    const r = reacao();
    const usuario = userEvent.setup();
    render(<ListaDeMensagens mensagens={REAGIVEIS} reacao={r} />);

    expect(screen.getAllByRole("button", { name: /Reagir à mensagem/ })).toHaveLength(1);
    expect(screen.getByRole("img", { name: "Reação do escritório: ❤️" })).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: "Reagir à mensagem de Maria" }));
    expect(r.aoAlternar).toHaveBeenCalledWith("1", expect.objectContaining({ top: 0 }));
  });

  it("escolher um emoji do seletor aberto reage àquela Mensagem", async () => {
    const r = reacao({ abertaId: "1" });
    const usuario = userEvent.setup();
    render(<ListaDeMensagens mensagens={REAGIVEIS} reacao={r} />);

    const painel = screen.getByRole("group", { name: "Emojis da reação" });
    await usuario.click(within(painel).getByRole("button", { name: "Joinha" }));

    expect(r.aoEscolher).toHaveBeenCalledWith("1", "👍");
  });

  it("conversa encerrada (ativa=false) não oferece reação, e o erro aparece", () => {
    render(
      <ListaDeMensagens
        mensagens={REAGIVEIS}
        reacao={reacao({ ativa: false, erro: "Falha ao enviar a reação." })}
      />,
    );

    expect(screen.queryByRole("button", { name: /Reagir à mensagem/ })).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Falha ao enviar a reação.");
  });

  it("o erro de reação fica fora do rolador (role=log)", () => {
    render(
      <ListaDeMensagens
        mensagens={REAGIVEIS}
        reacao={reacao({ erro: "Falha ao enviar a reação." })}
      />,
    );

    expect(within(screen.getByRole("log")).queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("com arraste, a moldura aparece enquanto um arquivo passa por cima e os eventos vão ao Container", () => {
    const onDrop = jest.fn();
    const { rerender } = render(
      <ListaDeMensagens mensagens={[]} arraste={{ arrastando: false, ligacoes: { onDrop } }} />,
    );
    expect(screen.queryByText("Solte para anexar")).not.toBeInTheDocument();

    fireEvent.drop(screen.getByRole("log"));
    expect(onDrop).toHaveBeenCalled();

    rerender(
      <ListaDeMensagens mensagens={[]} arraste={{ arrastando: true, ligacoes: { onDrop } }} />,
    );
    expect(screen.getByText("Solte para anexar")).toBeInTheDocument();
  });
});
