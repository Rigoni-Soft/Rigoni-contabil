import { render, screen } from "@testing-library/react";

import { CartaoDePonto } from "./cartao-de-ponto.component";

const LINHA = {
  data: "2026-11-16",
  rotulo: "seg 16/11",
  entrada1: "",
  saida1: "",
  entrada2: "",
  saida2: "",
  extraEntrada: "",
  extraSaida: "",
  abono: false,
};
const PROPS = {
  empregado: "Ana",
  rotuloMes: "novembro de 2026",
  mesAnteriorHref: "/rh/folha-de-ponto/c1?mes=2026-10",
  quinzenas: [
    { rotulo: "1ª quinzena (1 a 15)", href: "/q1", atual: false },
    { rotulo: "2ª quinzena (16 ao fim)", href: "/q2", atual: true },
  ],
  linhas: [LINHA],
  totalizacao: [{ rotulo: "Faltas", valor: "1 dia" }],
  editavel: true,
  pendente: false,
  onSalvarDia: jest.fn(),
};

describe("CartaoDePonto", () => {
  it("mostra o empregado, o mês, as quinzenas, os dias e a Totalização", () => {
    render(<CartaoDePonto {...PROPS} />);

    expect(screen.getByRole("heading", { name: "Cartão de ponto de Ana" })).toBeInTheDocument();
    expect(screen.getByText("novembro de 2026")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "2ª quinzena (16 ao fim)" })).toHaveAttribute(
      "href",
      "/q2",
    );
    expect(screen.getByRole("form", { name: "Dia seg 16/11" })).toBeInTheDocument();
    expect(screen.getByText("1 dia")).toBeInTheDocument();
  });

  it("em leitura avisa que só o Responsável digita", () => {
    render(<CartaoDePonto {...PROPS} editavel={false} />);

    expect(screen.getByText(/Só o Responsável do RH do cliente digita/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Salvar/ })).not.toBeInTheDocument();
  });

  it("mostra o erro da gravação", () => {
    render(<CartaoDePonto {...PROPS} erro="Horário inválido." />);

    expect(screen.getByRole("alert")).toHaveTextContent("Horário inválido.");
  });
});
