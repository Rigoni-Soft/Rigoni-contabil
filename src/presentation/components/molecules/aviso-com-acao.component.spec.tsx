import { fireEvent, render, screen } from "@testing-library/react";

import { AvisoComAcao } from "./aviso-com-acao.component";

describe("AvisoComAcao", () => {
  it("mostra o aviso e chama a ação ao clicar", () => {
    const onAcao = jest.fn();
    render(<AvisoComAcao texto="Falhou." rotuloDaAcao="Tentar novamente" onAcao={onAcao} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Falhou.");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(onAcao).toHaveBeenCalledTimes(1);
  });
});
