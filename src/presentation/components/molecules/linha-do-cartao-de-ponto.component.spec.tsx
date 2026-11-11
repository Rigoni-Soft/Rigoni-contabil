import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LinhaDoCartaoDePonto, type LinhaDoCartao } from "./linha-do-cartao-de-ponto.component";

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
};

describe("LinhaDoCartaoDePonto", () => {
  it("mostra o dia, a nota e os horários digitados", () => {
    render(<LinhaDoCartaoDePonto linha={LINHA} editavel pendente={false} onSalvar={jest.fn()} />);

    expect(screen.getByText("Feriado")).toBeInTheDocument();
    expect(screen.getByLabelText("Entrada 1 de seg 16/11")).toHaveValue("08:00");
    expect(screen.getByLabelText("Saída 2 de seg 16/11")).toHaveValue("");
  });

  it("salvar entrega a data e os campos do dia", async () => {
    const onSalvar = jest.fn();
    render(<LinhaDoCartaoDePonto linha={LINHA} editavel pendente={false} onSalvar={onSalvar} />);

    await userEvent.setup().click(screen.getByRole("checkbox", { name: "Abono" }));
    await userEvent.setup().click(screen.getByRole("button", { name: "Salvar seg 16/11" }));

    expect(onSalvar).toHaveBeenCalledTimes(1);
    const [data, campos] = onSalvar.mock.calls[0] as [string, FormData];
    expect(data).toBe("2026-11-16");
    expect(campos.get("entrada1")).toBe("08:00");
    expect(campos.get("abono")).not.toBeNull();
  });

  it("em leitura, trava os campos e some com o Salvar", () => {
    render(
      <LinhaDoCartaoDePonto linha={LINHA} editavel={false} pendente={false} onSalvar={jest.fn()} />,
    );

    expect(screen.getByLabelText("Entrada 1 de seg 16/11")).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Salvar/ })).not.toBeInTheDocument();
  });
});
