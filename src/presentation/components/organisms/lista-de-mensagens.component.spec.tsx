import { render, screen, within } from "@testing-library/react";

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
