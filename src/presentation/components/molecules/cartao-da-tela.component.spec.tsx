import { render, screen } from "@testing-library/react";

import { CartaoDaTela } from "./cartao-da-tela.component";

describe("CartaoDaTela", () => {
  it("envolve o conteúdo na moldura do cartão", () => {
    render(
      <CartaoDaTela>
        <p>Conteúdo</p>
      </CartaoDaTela>,
    );

    expect(screen.getByText("Conteúdo").parentElement).toHaveClass("rc-guilloche-frame");
  });
});
