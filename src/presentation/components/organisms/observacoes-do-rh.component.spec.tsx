import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ObservacoesDoRh } from "./observacoes-do-rh.component";

const BASE = {
  valor: "Folha no 5º dia útil.",
  onMudar: jest.fn(),
  onSalvar: jest.fn(),
  pendente: false,
};

describe("ObservacoesDoRh", () => {
  it("mostra as observações do RH e salva ao clicar", async () => {
    render(<ObservacoesDoRh {...BASE} />);

    expect(screen.getByLabelText("Observações gerais do RH")).toHaveValue("Folha no 5º dia útil.");
    await userEvent.click(screen.getByRole("button", { name: "Salvar observações do RH" }));

    expect(BASE.onSalvar).toHaveBeenCalled();
  });

  it("avisa o erro e o sucesso, e bloqueia o botão enquanto salva", () => {
    const { rerender } = render(<ObservacoesDoRh {...BASE} erro="Sem permissão." />);
    expect(screen.getByText("Sem permissão.")).toBeInTheDocument();
    expect(screen.getByLabelText("Observações gerais do RH")).toHaveAccessibleDescription(
      "Sem permissão.",
    );

    rerender(<ObservacoesDoRh {...BASE} sucesso pendente />);
    expect(screen.getByText("Observações do RH atualizadas.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvando…" })).toBeDisabled();
  });
});
