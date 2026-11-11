import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AcompanhamentoDoClienteRh } from "./acompanhamento-do-cliente-rh.component";

const PROPS = {
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

  it("o serviço que nunca se aplica fica desabilitado e só volta pelo botão Reativar", async () => {
    const onTrocar = jest.fn();
    render(
      <AcompanhamentoDoClienteRh
        {...PROPS}
        onTrocar={onTrocar}
        servicos={[{ servicoId: "nutri", nome: "NUTRI", estado: "nunca_aplica" }]}
      />,
    );

    expect(screen.getByLabelText("NUTRI")).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Reativar NUTRI" }));
    expect(onTrocar).toHaveBeenCalledWith("nutri", "nunca_aplica", "pendente");
  });

  it("mostra o aviso do cartão e o erro", () => {
    render(
      <AcompanhamentoDoClienteRh
        {...PROPS}
        aviso="Este cliente não está na sua vista do RH."
        erro="Não foi possível salvar."
      />,
    );

    expect(screen.getByText("Este cliente não está na sua vista do RH.")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível salvar.");
  });

  it("mostra os empregados cadastrados x cartões feitos do Holerite", () => {
    render(
      <AcompanhamentoDoClienteRh
        {...PROPS}
        resumoDoHolerite="2 empregados cadastrados · 1 de 2 cartões feitos no mês"
      />,
    );

    expect(
      screen.getByText("2 empregados cadastrados · 1 de 2 cartões feitos no mês"),
    ).toBeInTheDocument();
  });
});
