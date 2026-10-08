import { render, screen } from "@testing-library/react";

import { MensagemBalao } from "./mensagem-balao.component";

const BASE = { autor: "Maria", detalhe: null, texto: "oi", hora: "08/10 12:30" };

describe("MensagemBalao", () => {
  it("mostra quem escreveu, o detalhe, o texto e a hora", () => {
    render(
      <ul>
        <MensagemBalao {...BASE} lado="contato" detalhe="CNPJ 11.444.777/0001-61" />
      </ul>,
    );

    const balao = screen.getByRole("listitem");
    expect(balao).toHaveTextContent("Maria");
    expect(balao).toHaveTextContent("CNPJ 11.444.777/0001-61");
    expect(balao).toHaveTextContent("oi");
    expect(balao).toHaveTextContent("08/10 12:30");
  });

  it("cliente à esquerda; atendente e URA à direita", () => {
    render(
      <ul>
        <MensagemBalao {...BASE} lado="contato" texto="do cliente" />
        <MensagemBalao {...BASE} lado="atendente" texto="do atendente" />
        <MensagemBalao {...BASE} lado="ura" texto="da URA" />
      </ul>,
    );

    expect(screen.getByText("do cliente").closest("li")).toHaveClass("self-start");
    expect(screen.getByText("do atendente").closest("li")).toHaveClass("self-end");
    expect(screen.getByText("da URA").closest("li")).toHaveClass("self-end");
  });

  it("sem detalhe não mostra linha extra", () => {
    render(
      <ul>
        <MensagemBalao {...BASE} lado="atendente" />
      </ul>,
    );

    expect(screen.getByRole("listitem")).not.toHaveTextContent("CNPJ");
  });
});
