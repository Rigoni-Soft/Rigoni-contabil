import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PainelDeTransferencia } from "./painel-de-transferencia.component";

const BASE = {
  setoresDestino: [
    { valor: "recepcao", rotulo: "Recepção" },
    { valor: "tributario", rotulo: "Tributário" },
  ],
  onTransferir: jest.fn(),
  transferindo: false,
};

describe("PainelDeTransferencia", () => {
  it("oferece só os Setores recebidos e envia o escolhido com o resumo", async () => {
    const aoTransferir = jest.fn();
    const usuario = userEvent.setup();
    render(<PainelDeTransferencia {...BASE} onTransferir={aoTransferir} />);

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

  it("não envia sem Setor e sem resumo (campos obrigatórios)", async () => {
    const aoTransferir = jest.fn();
    const usuario = userEvent.setup();
    render(<PainelDeTransferencia {...BASE} onTransferir={aoTransferir} />);

    await usuario.click(screen.getByRole("button", { name: "Transferir" }));

    expect(aoTransferir).not.toHaveBeenCalled();
  });

  it("trava o botão enquanto transfere e mostra o erro", () => {
    render(
      <PainelDeTransferencia
        {...BASE}
        transferindo
        aviso={{ tipo: "erro", texto: "Só Cliente do Simples Nacional ou MEI." }}
      />,
    );

    expect(screen.getByRole("button", { name: "Transferindo..." })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Só Cliente do Simples Nacional");
  });
});
