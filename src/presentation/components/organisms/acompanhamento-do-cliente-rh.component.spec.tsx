import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AcompanhamentoDoClienteRh } from "./acompanhamento-do-cliente-rh.component";

const PROPS = {
  rotuloCompetencia: "novembro de 2026",
  anteriorHref: "/clientes/c1?mes=2026-10",
  servicos: [
    { servicoId: "fgts", nome: "FGTS", estado: "pendente" as const },
    {
      servicoId: "holerite",
      nome: "Holerite",
      estado: "pendente" as const,
      bloqueio: "O Holerite é preenchido pelo sistema.",
    },
  ],
  pendente: false,
  onTrocar: jest.fn(),
};

describe("AcompanhamentoDoClienteRh", () => {
  it("lista cada serviço com o estado e deixa o do sistema bloqueado", () => {
    render(<AcompanhamentoDoClienteRh {...PROPS} />);

    expect(screen.getByRole("list", { name: "Acompanhamento do mês" })).toBeInTheDocument();
    expect(screen.getByLabelText("FGTS")).toHaveValue("pendente");
    expect(screen.getByLabelText("FGTS")).toBeEnabled();
    expect(screen.getByLabelText("Holerite")).toBeDisabled();
    expect(screen.getByLabelText("Holerite")).toHaveAccessibleDescription(
      "O Holerite é preenchido pelo sistema.",
    );
  });

  it("trocar o estado chama onTrocar com o serviço, o estado de origem e o de destino", async () => {
    render(<AcompanhamentoDoClienteRh {...PROPS} />);

    await userEvent.selectOptions(screen.getByLabelText("FGTS"), "concluido");

    expect(PROPS.onTrocar).toHaveBeenCalledWith("fgts", "pendente", "concluido");
  });

  it("mostra a navegação de mês e o erro", () => {
    render(<AcompanhamentoDoClienteRh {...PROPS} erro="Não foi possível salvar." />);

    expect(screen.getByRole("link", { name: "Mês anterior" })).toHaveAttribute(
      "href",
      "/clientes/c1?mes=2026-10",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível salvar.");
  });
});
