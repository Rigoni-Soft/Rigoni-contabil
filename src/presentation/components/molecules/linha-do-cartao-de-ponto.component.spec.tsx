import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LinhaDoCartaoDePonto, type LinhaDoCartao } from "./linha-do-cartao-de-ponto.component";

function Linha(props: React.ComponentProps<typeof LinhaDoCartaoDePonto>) {
  return (
    <table>
      <tbody>
        <LinhaDoCartaoDePonto {...props} />
      </tbody>
    </table>
  );
}

const LINHA: LinhaDoCartao = {
  data: "2026-11-16",
  rotulo: "seg 16/11",
  entrada1: "08:00",
  saida1: "12:00",
  entrada2: "",
  saida2: "",
  extraEntrada: "",
  extraSaida: "",
  abono: false,
  nota: "Feriado",
  diaSemana: "seg",
  diaMes: "16/11",
  trabalhado: "4h00",
  atraso: "0h00",
  extras: "0h00",
  faixa1: "",
  faixa2: "",
  noturno: "0h00",
};

const ACOES = {
  emEdicao: false,
  limpa: false,
  onEditar: jest.fn(),
  onCancelar: jest.fn(),
};

describe("LinhaDoCartaoDePonto", () => {
  beforeEach(() => jest.clearAllMocks());

  it("fora da edição mostra o dia, a nota e os horários travados, só com o lápis", () => {
    render(<Linha linha={LINHA} editavel {...ACOES} pendente={false} onSalvar={jest.fn()} />);

    expect(screen.getByText("Feriado")).toBeInTheDocument();
    expect(screen.getByText("4h00")).toBeInTheDocument();
    expect(screen.getByLabelText("Entrada 1 de seg 16/11")).toHaveValue("08:00");
    expect(screen.getByLabelText("Entrada 1 de seg 16/11")).toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "Editar seg 16/11" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Salvar seg 16/11" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cancelar edição/ })).not.toBeInTheDocument();
  });

  it("o lápis pede para editar o dia", async () => {
    render(<Linha linha={LINHA} editavel {...ACOES} pendente={false} onSalvar={jest.fn()} />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Editar seg 16/11" }));

    expect(ACOES.onEditar).toHaveBeenCalledWith("2026-11-16");
  });

  it("em edição destrava os campos e troca o lápis por salvar e cancelar", () => {
    render(
      <Linha linha={LINHA} editavel {...ACOES} emEdicao pendente={false} onSalvar={jest.fn()} />,
    );

    expect(screen.getByLabelText("Entrada 1 de seg 16/11")).not.toHaveAttribute("readonly");
    expect(screen.queryByRole("button", { name: "Editar seg 16/11" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar seg 16/11" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cancelar edição de seg 16/11" }),
    ).toBeInTheDocument();
  });

  it("salvar entrega a data e os campos do dia; cancelar avisa a tela", async () => {
    const onSalvar = jest.fn();
    render(
      <Linha linha={LINHA} editavel {...ACOES} emEdicao pendente={false} onSalvar={onSalvar} />,
    );
    const u = userEvent.setup();

    await u.click(screen.getByRole("checkbox", { name: "Abono de seg 16/11" }));
    await u.click(screen.getByRole("button", { name: "Salvar seg 16/11" }));
    await u.click(screen.getByRole("button", { name: "Cancelar edição de seg 16/11" }));

    expect(onSalvar).toHaveBeenCalledTimes(1);
    const [data, campos] = onSalvar.mock.calls[0] as [string, FormData];
    expect(data).toBe("2026-11-16");
    expect(campos.get("entrada1")).toBe("08:00");
    expect(campos.get("abono")).not.toBeNull();
    expect(ACOES.onCancelar).toHaveBeenCalledWith("2026-11-16");
  });

  it("limpa mostra os campos vazios", () => {
    render(
      <Linha
        linha={LINHA}
        editavel
        {...ACOES}
        emEdicao
        limpa
        pendente={false}
        onSalvar={jest.fn()}
      />,
    );

    expect(screen.getByLabelText("Entrada 1 de seg 16/11")).toHaveValue("");
  });

  it("mostra o aviso do dia e o liga aos campos", () => {
    render(
      <Linha
        linha={LINHA}
        editavel
        {...ACOES}
        pendente={false}
        aviso={{ tipo: "sucesso", texto: "Salvo." }}
        onSalvar={jest.fn()}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Salvo.");
    expect(screen.getByLabelText("Entrada 1 de seg 16/11")).toHaveAccessibleDescription("Salvo.");
  });

  it("em leitura não oferece lápis nem salvar", () => {
    render(
      <Linha linha={LINHA} editavel={false} {...ACOES} pendente={false} onSalvar={jest.fn()} />,
    );

    expect(screen.getByLabelText("Entrada 1 de seg 16/11")).toHaveAttribute("readonly");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
