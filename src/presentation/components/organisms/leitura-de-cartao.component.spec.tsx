import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LeituraDeCartao } from "./leitura-de-cartao.component";

const base = {
  rotuloMes: "09/2026",
  pendente: false,
  onArquivo: jest.fn(),
  onLer: jest.fn(),
};

describe("LeituraDeCartao", () => {
  it("diz o mês, que a foto não é guardada e oferece as duas quinzenas", () => {
    render(<LeituraDeCartao {...base} />);

    expect(screen.getByRole("form", { name: "Ler foto do cartão" })).toBeInTheDocument();
    expect(screen.getByText(/quinzena de 09\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/A foto não é guardada/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Quinzena/)).toHaveValue("1");
    expect(screen.getByRole("option", { name: "2ª quinzena (dia 16 ao fim)" })).toBeInTheDocument();
  });

  it("entrega os campos ao ler e, pendente, avisa e usa aria-disabled em vez de disabled", async () => {
    const onLer = jest.fn();
    const { rerender } = render(<LeituraDeCartao {...base} onLer={onLer} />);
    await userEvent.click(screen.getByRole("button", { name: "Ler cartão" }));
    expect(onLer).toHaveBeenCalledTimes(1);

    rerender(<LeituraDeCartao {...base} pendente />);
    const botao = screen.getByRole("button", { name: "Lendo o cartão…" });
    expect(botao).toHaveAttribute("aria-disabled", "true");
    expect(botao).not.toBeDisabled();
  });

  it("mostra o erro (alerta) e o resultado (status)", () => {
    const { rerender } = render(<LeituraDeCartao {...base} erro="Digite à mão." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Digite à mão.");

    rerender(<LeituraDeCartao {...base} erro="Escolha a foto." erroNoCampo />);
    const foto = screen.getByLabelText(/Foto do cartão/);
    expect(foto).toBeInvalid();
    expect(foto).toHaveAccessibleDescription(/Escolha a foto/);

    rerender(<LeituraDeCartao {...base} resultado="Erick: 3 dias lidos." />);
    expect(screen.getByRole("status")).toHaveTextContent("Erick: 3 dias lidos.");
  });
});
