import { render } from "@testing-library/react";

import { MOLDURA_DO_CARTAO } from "@/presentation/lib/moldura-do-cartao";

import { CartaoDaTela } from "./cartao-da-tela.component";

describe("CartaoDaTela", () => {
  it("envolve o conteúdo na moldura do cartão", () => {
    const { container } = render(
      <CartaoDaTela>
        <p>Conteúdo</p>
      </CartaoDaTela>,
    );

    expect(container.firstChild).toHaveClass(...MOLDURA_DO_CARTAO.split(" "));
  });
});
