import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PainelDeEncerramento } from "./painel-de-encerramento.component";

function montar(props: Partial<React.ComponentProps<typeof PainelDeEncerramento>> = {}) {
  const acoes = { onPedir: jest.fn(), onCancelar: jest.fn(), onConfirmar: jest.fn() };
  render(<PainelDeEncerramento confirmando={false} encerrando={false} {...acoes} {...props} />);
  return acoes;
}

describe("PainelDeEncerramento", () => {
  it("o primeiro clique só pede a confirmação", async () => {
    const { onPedir, onConfirmar } = montar();

    await userEvent.click(screen.getByRole("button", { name: "Encerrar atendimento" }));

    expect(onPedir).toHaveBeenCalled();
    expect(onConfirmar).not.toHaveBeenCalled();
  });

  it("confirmando, avisa que o cliente será avisado e permite confirmar ou cancelar", async () => {
    const { onConfirmar, onCancelar } = montar({ confirmando: true });

    expect(screen.getByRole("alertdialog")).toHaveAccessibleDescription(/cliente será avisado/);
    await userEvent.click(screen.getByRole("button", { name: "Confirmar encerramento" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onConfirmar).toHaveBeenCalled();
    expect(onCancelar).toHaveBeenCalled();
  });

  it("enquanto encerra os botões ficam travados e o foco não se perde", async () => {
    const { onCancelar } = montar({ confirmando: true, encerrando: true });

    expect(screen.getByRole("button", { name: "Encerrando…" })).toBeDisabled();
    const cancelar = screen.getByRole("button", { name: "Cancelar" });
    expect(cancelar).toHaveAttribute("aria-disabled", "true");
    expect(cancelar).toHaveFocus();
    await userEvent.click(cancelar);
    expect(onCancelar).not.toHaveBeenCalled();
  });

  it("mostra o erro", () => {
    montar({ aviso: { tipo: "erro", texto: "Você não pode encerrar este Atendimento." } });

    expect(screen.getByText("Você não pode encerrar este Atendimento.")).toBeInTheDocument();
  });
});
