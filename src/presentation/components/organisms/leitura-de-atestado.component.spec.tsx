import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LeituraDeAtestado } from "./leitura-de-atestado.component";

const base = {
  painelId: "modal-atestado",
  nomeDoEmpregado: "Roberto",
  pendente: false,
  aoAbrir: jest.fn(),
  aoFechar: jest.fn(),
  onArquivo: jest.fn(),
  onLer: jest.fn(),
};

describe("LeituraDeAtestado", () => {
  it("o botão chama aoAbrir e a modal diz de quem são os dias e que a foto e o CID não são guardados", async () => {
    const aoAbrir = jest.fn();
    render(<LeituraDeAtestado {...base} aoAbrir={aoAbrir} />);

    await userEvent.click(screen.getByRole("button", { name: "Ler atestado" }));

    expect(aoAbrir).toHaveBeenCalled();
    expect(screen.getByText(/abona os dias de Roberto/, { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/não são guardados/)).toBeInTheDocument();
  });

  it("erro da foto vai no campo; erro da leitura vai como aviso", () => {
    const { rerender } = render(
      <LeituraDeAtestado {...base} erro="A foto passa de 4 MB." erroNoCampo />,
    );
    expect(screen.getByLabelText("Foto do atestado (JPEG ou PNG)")).toHaveAttribute(
      "aria-invalid",
      "true",
    );

    rerender(<LeituraDeAtestado {...base} erro="O nome no atestado não confere." />);
    expect(screen.getByLabelText("Foto do atestado (JPEG ou PNG)")).toHaveAttribute(
      "aria-invalid",
      "false",
    );
    expect(screen.getByText("O nome no atestado não confere.")).toBeInTheDocument();
  });

  it("enquanto lê, o botão diz que está lendo e fica aria-disabled (focável)", () => {
    render(<LeituraDeAtestado {...base} pendente />);

    expect(
      // A modal está fechada no jsdom: o botão fica fora da árvore de acessibilidade.
      screen.getByRole("button", { name: "Lendo o atestado…", hidden: true }),
    ).toHaveAttribute("aria-disabled", "true");
  });
});
