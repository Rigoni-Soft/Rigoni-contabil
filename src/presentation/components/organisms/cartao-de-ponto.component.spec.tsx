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
  diaSemana: "seg",
  diaMes: "16/11",
  trabalhado: "0h00",
  atraso: "0h00",
  extras: "0h00",
  faixa1: "",
  faixa2: "",
  noturno: "0h00",
};
const PROPS = {
  empregado: "Ana",
  empresa: "Teste Ltda",
  periodo: "novembro de 2026",
  rotuloMes: "novembro de 2026",
  mesAnteriorHref: "/rh/folha-de-ponto/c1?mes=2026-10",
  linhas: [LINHA],
  totais: {
    faltas: "1",
    trabalhado: "0h00",
    atraso: "0h00",
    extras: "0h00",
    noturno: "0h00",
    faixas: "",
  },
  totalizacao: [{ rotulo: "Faltas", valor: "1 dia" }],
  empregadoId: "e1",
  editavel: true,
  pendente: false,
  onSalvarDia: jest.fn(),
};

describe("CartaoDePonto", () => {
  it("mostra o empregado, o mês, os dias e a Totalização", () => {
    render(<CartaoDePonto {...PROPS} />);

    expect(screen.getByRole("heading", { name: "Cartão de ponto de Ana" })).toBeInTheDocument();
    expect(screen.getByText("novembro de 2026")).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Dia seg 16/11" })).toBeInTheDocument();
    expect(screen.getByText("1 dia")).toBeInTheDocument();
    expect(screen.getByText(/Empresa: Teste Ltda · Período: novembro de 2026/)).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "H. Diária" })).toBeInTheDocument();
    expect(screen.getByText("Faltas / Suspensão: 1")).toBeInTheDocument();
  });

  it("em leitura avisa que só o Responsável digita", () => {
    render(<CartaoDePonto {...PROPS} editavel={false} />);

    expect(screen.getByText(/Só o Responsável do RH do cliente digita/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Salvar/ })).not.toBeInTheDocument();
  });

  it("mostra o resultado do Salvar na linha do dia, e só nela", () => {
    render(
      <CartaoDePonto
        {...PROPS}
        aviso={{ data: "2026-11-16", tipo: "erro", texto: "Horário inválido." }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Horário inválido.");
    expect(screen.getByLabelText("Entrada 1 de seg 16/11")).toHaveAccessibleDescription(
      "Horário inválido.",
    );
  });

  it("aviso de outro dia não aparece nesta linha", () => {
    render(
      <CartaoDePonto {...PROPS} aviso={{ data: "2026-11-17", tipo: "sucesso", texto: "Salvo." }} />,
    );

    expect(screen.queryByText("Salvo.")).not.toBeInTheDocument();
  });
});
