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
  situacao: "normal" as const,
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
  focar: false,
  onEditar: jest.fn(),
  onAbonar: jest.fn(),
  onDesfazerAbono: jest.fn(),
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

    await u.click(screen.getByRole("button", { name: "Salvar seg 16/11" }));
    await u.click(screen.getByRole("button", { name: "Cancelar edição de seg 16/11" }));

    expect(onSalvar).toHaveBeenCalledTimes(1);
    const [data, campos] = onSalvar.mock.calls[0] as [string, FormData];
    expect(data).toBe("2026-11-16");
    expect(campos.get("entrada1")).toBe("08:00");
    expect(campos.get("abono")).toBeNull();
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

  it("dia de falta oferece o Abonar além do lápis, e abonar avisa a tela", async () => {
    render(
      <Linha
        linha={{ ...LINHA, situacao: "falta" as const, tom: "alerta", nota: "Falta" }}
        editavel
        {...ACOES}
        pendente={false}
        onSalvar={jest.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Editar seg 16/11" })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Abonar seg 16/11" }));

    expect(ACOES.onAbonar).toHaveBeenCalledWith("2026-11-16");
  });

  it("dia que não é falta não oferece Abonar", () => {
    render(<Linha linha={LINHA} editavel {...ACOES} pendente={false} onSalvar={jest.fn()} />);

    expect(screen.queryByRole("button", { name: /Abonar/ })).not.toBeInTheDocument();
  });

  it.each([
    ["alerta", /destructive/],
    ["atencao", /warning/],
    ["info", /info/],
  ] as const)("o tom %s pinta a linha", (tom, cor) => {
    render(
      <Linha linha={{ ...LINHA, tom }} editavel {...ACOES} pendente={false} onSalvar={jest.fn()} />,
    );

    expect(screen.getByRole("row").className).toMatch(cor);
  });

  it("dia normal fica sem tom", () => {
    render(<Linha linha={LINHA} editavel {...ACOES} pendente={false} onSalvar={jest.fn()} />);

    expect(screen.getByRole("row").className).not.toMatch(/destructive|warning|info/);
  });

  it("não há coluna nem caixa de Abono: o Abono é o botão da falta", () => {
    render(
      <Linha linha={LINHA} editavel {...ACOES} emEdicao pendente={false} onSalvar={jest.fn()} />,
    );

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("dia abonado: horários desabilitados e o botão é Desfazer abono", async () => {
    render(
      <Linha
        linha={{ ...LINHA, entrada1: "", saida1: "", situacao: "abonado", nota: "Abonado" }}
        editavel
        {...ACOES}
        pendente={false}
        onSalvar={jest.fn()}
      />,
    );

    expect(screen.getByLabelText("Entrada 1 de seg 16/11")).toBeDisabled();
    expect(screen.getByLabelText("Extra entrada de seg 16/11")).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Editar/ })).not.toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Desfazer abono de seg 16/11" }));
    expect(ACOES.onDesfazerAbono).toHaveBeenCalledWith("2026-11-16");
  });

  it("dia de folga ou feriado sem batida salva: só a coluna Extra fica habilitada", () => {
    render(
      <Linha
        linha={{ ...LINHA, entrada1: "", saida1: "", situacao: "folga" }}
        editavel
        {...ACOES}
        emEdicao
        pendente={false}
        onSalvar={jest.fn()}
      />,
    );

    expect(screen.getByLabelText("Entrada 1 de seg 16/11")).toBeDisabled();
    expect(screen.getByLabelText("Saída 2 de seg 16/11")).toBeDisabled();
    expect(screen.getByLabelText("Extra entrada de seg 16/11")).toBeEnabled();
    expect(screen.getByLabelText("Extra saída de seg 16/11")).toBeEnabled();
  });

  it("folga com batida já salva não trava as batidas (nada some sem querer)", () => {
    render(
      <Linha
        linha={{ ...LINHA, situacao: "folga" }}
        editavel
        {...ACOES}
        emEdicao
        pendente={false}
        onSalvar={jest.fn()}
      />,
    );

    expect(screen.getByLabelText("Entrada 1 de seg 16/11")).toBeEnabled();
  });

  it("dia de falta aberto pelo lápis destrava os horários (é a forma deliberada de lançar)", () => {
    render(
      <Linha
        linha={{ ...LINHA, entrada1: "", saida1: "", situacao: "falta", tom: "alerta" }}
        editavel
        {...ACOES}
        emEdicao
        pendente={false}
        onSalvar={jest.fn()}
      />,
    );

    expect(screen.getByLabelText("Entrada 1 de seg 16/11")).toBeEnabled();
  });

  it("o foco vai ao lápis da linha que acabou de ter uma ação (não cai no corpo da página)", () => {
    render(<Linha linha={LINHA} editavel {...ACOES} focar pendente={false} onSalvar={jest.fn()} />);

    expect(screen.getByRole("button", { name: "Editar seg 16/11" })).toHaveFocus();
  });

  it("ao abrir a edição o foco vai ao primeiro campo habilitado", () => {
    render(
      <Linha
        linha={LINHA}
        editavel
        {...ACOES}
        emEdicao
        focar
        pendente={false}
        onSalvar={jest.fn()}
      />,
    );

    expect(screen.getByLabelText("Entrada 1 de seg 16/11")).toHaveFocus();
  });

  it("em folga sem batida o foco vai à Extra entrada (a primeira habilitada)", () => {
    render(
      <Linha
        linha={{ ...LINHA, entrada1: "", saida1: "", situacao: "folga" }}
        editavel
        {...ACOES}
        emEdicao
        focar
        pendente={false}
        onSalvar={jest.fn()}
      />,
    );

    expect(screen.getByLabelText("Extra entrada de seg 16/11")).toHaveFocus();
  });
});
