import { render, screen } from "@testing-library/react";

import { CartaoDeAtendimento } from "./cartao-de-atendimento.component";

describe("CartaoDeAtendimento", () => {
  it("é um link para a conversa, com o contato e a empresa", () => {
    render(<CartaoDeAtendimento href="/atendimento/at-1" titulo="Maria" detalhe="Padaria Ltda" />);

    expect(screen.getByRole("link", { name: /Maria/ })).toHaveAttribute(
      "href",
      "/atendimento/at-1",
    );
    expect(screen.getByText("Padaria Ltda")).toBeInTheDocument();
  });

  it("mostra a prévia da última mensagem", () => {
    render(
      <CartaoDeAtendimento
        href="/x"
        titulo="Maria"
        detalhe="Padaria"
        previa="preciso do contrato"
      />,
    );

    expect(screen.getByText("preciso do contrato")).toBeInTheDocument();
  });

  it("aguardando resposta: mostra o ponto e avisa leitor de tela da nova mensagem", () => {
    render(<CartaoDeAtendimento href="/x" titulo="Maria" detalhe="Padaria" aguardando />);

    expect(screen.getByRole("link", { name: /nova mensagem/ })).toBeInTheDocument();
  });

  it("entra com animação, que respeita movimento reduzido (motion-safe)", () => {
    render(<CartaoDeAtendimento href="/x" titulo="Maria" detalhe="Padaria" />);

    expect(screen.getByRole("link")).toHaveClass("motion-safe:animate-dock-entrada");
  });
});
