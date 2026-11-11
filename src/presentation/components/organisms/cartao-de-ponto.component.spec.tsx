import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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
  situacao: "normal" as const,
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
  totalizacao: [{ rotulo: "Faltas", valor: "1 dia" }],
  empregadoId: "e1",
  editavel: true,
  pendente: false,
  diasEmEdicao: [] as string[],
  diasLimpos: [] as string[],
  versoes: {},
  listaHref: "/rh/folha-de-ponto/c1?mes=2026-11",
  totalizacaoDestacada: false,
  onEditarDia: jest.fn(),
  onAbonarDia: jest.fn(),
  onDesfazerAbonoDia: jest.fn(),
  onCancelarDia: jest.fn(),
  onSalvarDia: jest.fn(),
  onSalvarTabela: jest.fn(),
  onLimparTabela: jest.fn(),
};

describe("CartaoDePonto", () => {
  it("mostra o empregado, o mês, os dias e a Totalização", () => {
    render(<CartaoDePonto {...PROPS} />);

    // O título da tela já é "Cartão de ponto": o do cartão traz só o nome.
    expect(screen.getByRole("heading", { name: "Ana" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Cartão de ponto de/ })).not.toBeInTheDocument();
    expect(screen.getByText("novembro de 2026")).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Dia seg 16/11" })).toBeInTheDocument();
    expect(screen.getByText("1 dia")).toBeInTheDocument();
    expect(screen.getByText(/Empresa: Teste Ltda · Período: novembro de 2026/)).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "H. Diária" })).toBeInTheDocument();
    expect(screen.queryByText(/Faltas \/ Suspensão/)).not.toBeInTheDocument();
    // A.N. por extenso e a coluna do botão sem título visível.
    expect(screen.getByRole("columnheader", { name: "Adicional noturno" })).toBeInTheDocument();
    expect(screen.queryByText("A.N.")).not.toBeInTheDocument();
    expect(screen.queryByText("Dia", { exact: true })).not.toBeInTheDocument();
    // A coluna Abono saiu: o abono é o botão da falta.
    expect(screen.queryByRole("columnheader", { name: "Abono" })).not.toBeInTheDocument();
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

  it("entre a tabela e a Totalização ficam Salvar, Limpar e Cancelar", async () => {
    const u = userEvent.setup();
    render(<CartaoDePonto {...PROPS} diasEmEdicao={["2026-11-16"]} />);

    await u.click(screen.getByRole("button", { name: "Salvar" }));
    await u.click(screen.getByRole("button", { name: "Limpar" }));

    expect(PROPS.onSalvarTabela).toHaveBeenCalledTimes(1);
    expect(PROPS.onLimparTabela).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: "Cancelar" })).toHaveAttribute(
      "href",
      "/rh/folha-de-ponto/c1?mes=2026-11",
    );
  });

  it("a barra de ações fica no fim da linha: Salvar verde, Limpar amarelo, Cancelar vermelho", () => {
    render(<CartaoDePonto {...PROPS} diasEmEdicao={["2026-11-16"]} />);

    expect(screen.getByRole("button", { name: "Salvar" })).toHaveClass("bg-primary");
    expect(screen.getByRole("button", { name: "Limpar" })).toHaveClass("bg-warning");
    expect(screen.getByRole("link", { name: "Cancelar" })).toHaveClass("bg-destructive");
    expect(screen.getByRole("button", { name: "Salvar" }).parentElement).toHaveClass("justify-end");
  });

  it("Salvar e Limpar da tabela só valem com uma linha aberta", () => {
    render(<CartaoDePonto {...PROPS} />);

    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Limpar" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Cancelar" })).toBeInTheDocument();
  });

  it("depois de salvar a Totalização ganha destaque", () => {
    const { rerender } = render(<CartaoDePonto {...PROPS} />);
    const bloco = () => screen.getByRole("region", { name: "Totalização do mês" });
    expect(bloco()).not.toHaveClass("border-primary");

    rerender(<CartaoDePonto {...PROPS} totalizacaoDestacada />);
    expect(bloco()).toHaveClass("border-primary");
  });

  it("em leitura não há ações da tabela", () => {
    render(<CartaoDePonto {...PROPS} editavel={false} />);

    expect(screen.queryByRole("button", { name: "Salvar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Cancelar" })).not.toBeInTheDocument();
  });
});
