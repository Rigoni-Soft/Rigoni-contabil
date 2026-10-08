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
});
