import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AjustesDoClienteNaConvencao } from "./ajustes-do-cliente-na-convencao.component";

const base = {
  bancoDeHoras: false,
  trabalhoAosDomingos: true,
  sindicatos: ["Comércio", "Escritórios"],
  empregados: [{ id: "e1", nome: "Ana", sindicato: "Comércio" }],
  editavel: true,
  pendente: false,
  onBancoDeHoras: jest.fn(),
  onTrabalhoAosDomingos: jest.fn(),
  onSindicato: jest.fn(),
};

describe("AjustesDoClienteNaConvencao", () => {
  beforeEach(() => jest.clearAllMocks());

  it("mostra os interruptores como estão e avisa a mudança", async () => {
    render(<AjustesDoClienteNaConvencao {...base} />);
    const user = userEvent.setup();

    expect(screen.getByRole("checkbox", { name: "Banco de horas" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Trabalho aos domingos" })).toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: "Trabalho aos domingos" }));

    expect(base.onTrabalhoAosDomingos).toHaveBeenCalledWith(false);
  });

  it("o empregado mostra a convenção que segue e a lista traz as opções do Cliente", async () => {
    render(<AjustesDoClienteNaConvencao {...base} />);

    const select = screen.getByLabelText("Ana");
    expect(select).toHaveValue("Comércio");
    await userEvent.setup().selectOptions(select, "Escritórios");

    expect(base.onSindicato).toHaveBeenCalledWith("e1", "Escritórios");
    expect(screen.getByRole("option", { name: "Sem escolha (a única do cliente)" })).toBeVisible();
  });

  it("só pergunta a convenção de cada empregado havendo mais de uma", () => {
    render(<AjustesDoClienteNaConvencao {...base} sindicatos={["Comércio"]} />);

    expect(screen.queryByLabelText("Ana")).not.toBeInTheDocument();
  });

  it('enquanto grava, diz "Salvando…" e desabilita os controles', () => {
    render(<AjustesDoClienteNaConvencao {...base} pendente />);

    expect(screen.getByRole("status")).toHaveTextContent("Salvando…");
    expect(screen.getByRole("checkbox", { name: "Banco de horas" })).toBeDisabled();
  });

  it("em leitura, tudo desabilitado e com a nota de quem altera", () => {
    render(<AjustesDoClienteNaConvencao {...base} editavel={false} erro="Falhou." />);

    expect(screen.getByRole("checkbox", { name: "Banco de horas" })).toBeDisabled();
    expect(screen.getByLabelText("Ana")).toBeDisabled();
    expect(screen.getByText(/Só o Responsável do RH deste cliente/)).toBeInTheDocument();
    expect(screen.getByText("Falhou.")).toBeInTheDocument();
  });
});
