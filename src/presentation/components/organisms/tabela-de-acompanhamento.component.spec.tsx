import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TabelaDeAcompanhamento } from "./tabela-de-acompanhamento.component";

const BASE = {
  rotuloCompetencia: "novembro de 2026",
  anteriorHref: "?mes=2026-10",
  servicos: [{ id: "fgts", nome: "FGTS" }],
  pendente: false,
  onTrocar: jest.fn(),
};

const LINHA = {
  clienteId: "c1",
  empresa: "Padaria Sol",
  cnpj: "11444777000161",
  celulas: [{ servicoId: "fgts", estado: "pendente" as const }],
  pendentes: 1,
};

describe("TabelaDeAcompanhamento", () => {
  it("escolher outro estado entrega cliente, serviço, estado de origem e destino", async () => {
    const aoTrocar = jest.fn();
    render(<TabelaDeAcompanhamento {...BASE} linhas={[LINHA]} onTrocar={aoTrocar} />);

    await userEvent
      .setup()
      .selectOptions(screen.getByRole("combobox", { name: "FGTS de Padaria Sol" }), "concluido");

    expect(aoTrocar).toHaveBeenCalledWith("c1", "fgts", "pendente", "concluido");
  });

  it("célula bloqueada fica desabilitada e traz o motivo", () => {
    const celulas = [
      { servicoId: "fgts", estado: "concluido" as const, bloqueio: "Derivado do Holerite" },
    ];
    render(<TabelaDeAcompanhamento {...BASE} linhas={[{ ...LINHA, celulas }]} />);

    const select = screen.getByRole("combobox", { name: "FGTS de Padaria Sol" });
    expect(select).toBeDisabled();
    expect(select).toHaveAccessibleDescription("Derivado do Holerite");
  });

  it("durante a gravação ignora nova troca", async () => {
    const aoTrocar = jest.fn();
    render(<TabelaDeAcompanhamento {...BASE} linhas={[LINHA]} pendente onTrocar={aoTrocar} />);

    await userEvent
      .setup()
      .selectOptions(screen.getByRole("combobox", { name: "FGTS de Padaria Sol" }), "concluido");

    expect(aoTrocar).not.toHaveBeenCalled();
  });

  it("mostra o erro e, sem linhas, o vazio no lugar da tabela", () => {
    render(<TabelaDeAcompanhamento {...BASE} linhas={[]} erro="Falha ao gravar." />);

    expect(screen.getByRole("alert")).toHaveTextContent("Falha ao gravar.");
    expect(screen.getByText("Nenhum cliente com Responsável do RH neste mês.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
