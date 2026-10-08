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

  it("fica parada nas últimas mensagens: o DOM vai da mais nova para a mais antiga e a lista é col-reverse", () => {
    render(<ListaDeMensagens mensagens={MENSAGENS} />);

    const lista = screen.getByRole("list", { name: "Mensagens" });
    expect(lista).toHaveClass("flex-col-reverse", "overflow-y-auto");
    expect(within(lista).getAllByRole("listitem")[0]).toHaveTextContent("segunda");
  });
});
