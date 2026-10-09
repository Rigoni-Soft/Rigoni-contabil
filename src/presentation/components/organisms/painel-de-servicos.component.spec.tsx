import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PainelDeServicos } from "./painel-de-servicos.component";

const BASE = {
  semCliente: false,
  servicos: [
    { valor: "contrato", rotulo: "Contrato social", grupo: "contrato" as const },
    {
      valor: "alteracao:2026-03-01",
      rotulo: "Alteração de 01/03/2026",
      grupo: "alteracao" as const,
    },
    {
      valor: "alteracao:2025-01-10",
      rotulo: "Alteração de 10/01/2025",
      grupo: "alteracao" as const,
    },
  ],
  onEnviarServico: jest.fn(),
  enviando: false,
};

describe("PainelDeServicos", () => {
  it("um clique no contrato dispara o envio dele", async () => {
    const aoEnviar = jest.fn();
    const usuario = userEvent.setup();
    render(<PainelDeServicos {...BASE} onEnviarServico={aoEnviar} />);

    await usuario.click(screen.getByRole("button", { name: "Contrato social" }));

    expect(aoEnviar).toHaveBeenCalledWith("contrato");
  });

  it("a alteração contratual é escolhida num seletor e enviada pelo botão", async () => {
    const aoEnviar = jest.fn();
    const usuario = userEvent.setup();
    render(<PainelDeServicos {...BASE} onEnviarServico={aoEnviar} />);

    const seletor = screen.getByLabelText("Alteração contratual");
    expect(
      within(seletor)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Escolha a alteração", "Alteração de 01/03/2026", "Alteração de 10/01/2025"]);
    await usuario.selectOptions(seletor, "alteracao:2025-01-10");
    await usuario.click(screen.getByRole("button", { name: "Enviar alteração" }));

    expect(aoEnviar).toHaveBeenCalledWith("alteracao:2025-01-10");
  });

  it("Cliente sem contrato ou sem alterações mostra tudo desabilitado", () => {
    render(<PainelDeServicos {...BASE} servicos={[]} />);

    expect(screen.getByRole("button", { name: "Contrato social" })).toBeDisabled();
    expect(screen.getByLabelText("Alteração contratual")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Enviar alteração" })).toBeDisabled();
  });

  it("enquanto envia, os serviços ficam travados", () => {
    render(<PainelDeServicos {...BASE} enviando />);

    expect(screen.getByRole("button", { name: "Contrato social" })).toBeDisabled();
    expect(screen.getByText("Enviando...")).toBeInTheDocument();
  });

  it("sem Cliente vinculado explica por que não há serviços", () => {
    render(<PainelDeServicos {...BASE} semCliente servicos={[]} />);

    expect(screen.getByText(/Sem Cliente vinculado/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Contrato social" })).not.toBeInTheDocument();
  });

  it("mostra o aviso do envio", () => {
    render(<PainelDeServicos {...BASE} aviso={{ tipo: "erro", texto: "Falha ao enviar" }} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Falha ao enviar");
  });
});
