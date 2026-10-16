import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BotaoDeLink } from "./botao-de-link.component";
import { Caixa, Grade, Linha, Pilha } from "./caixa.component";
import {
  CabecalhoDeColuna,
  CelulaDeTabela,
  LinhaDeTabela,
  Tabela,
} from "./celula-de-tabela.component";
import { Opcao } from "./opcao.component";
import { Texto } from "./texto.component";

describe("átomos estruturais", () => {
  it("Caixa renderiza o elemento pedido e repassa atributos", () => {
    render(
      <Caixa como="section" aria-label="Painel" className="p-2">
        <Caixa como="ul">
          <Caixa como="li">item</Caixa>
        </Caixa>
      </Caixa>,
    );

    expect(screen.getByRole("region", { name: "Painel" })).toHaveClass("p-2");
    expect(screen.getByRole("listitem")).toHaveTextContent("item");
  });

  it("Caixa como form dispara o onSubmit", async () => {
    const aoEnviar = jest.fn((evento: React.FormEvent) => evento.preventDefault());
    render(
      <Caixa como="form" aria-label="Formulário" onSubmit={aoEnviar}>
        <button type="submit">Enviar</button>
      </Caixa>,
    );

    await userEvent.setup().click(screen.getByRole("button", { name: "Enviar" }));

    expect(aoEnviar).toHaveBeenCalled();
  });

  it("Texto repassa role e id; Opcao é um <option>", () => {
    render(
      <>
        <Texto variante="apoio" role="status" id="aviso">
          Pronto
        </Texto>
        <select aria-label="Setor">
          <Opcao value="a">A</Opcao>
        </select>
      </>,
    );

    expect(screen.getByRole("status")).toHaveAttribute("id", "aviso");
    expect(screen.getByRole("option", { name: "A" })).toBeInTheDocument();
  });

  it("Tabela monta cabeçalho de colunas e corpo", () => {
    render(
      <Tabela colunas={<CabecalhoDeColuna>Ator</CabecalhoDeColuna>}>
        <LinhaDeTabela>
          <CelulaDeTabela>Ana</CelulaDeTabela>
        </LinhaDeTabela>
      </Tabela>,
    );

    expect(screen.getByRole("columnheader", { name: "Ator" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Ana" })).toBeInTheDocument();
  });

  it("BotaoDeLink é um botão que dispara a ação", async () => {
    const aoClicar = jest.fn();
    render(<BotaoDeLink onClick={aoClicar}>Ler resumo completo</BotaoDeLink>);

    await userEvent.setup().click(screen.getByRole("button", { name: "Ler resumo completo" }));

    expect(aoClicar).toHaveBeenCalled();
  });

  it("Pilha, Linha e Grade traduzem as props nomeadas em layout", () => {
    render(
      <>
        <Pilha espaco="campo" data-testid="pilha" />
        <Linha alinhar="centro" justificar="entre" espaco={2} quebra data-testid="linha" />
        <Grade colunas="1>2" espaco={4} como="ul" data-testid="grade" />
      </>,
    );

    expect(screen.getByTestId("pilha")).toHaveClass("flex", "flex-col", "gap-1.5");
    expect(screen.getByTestId("linha")).toHaveClass(
      "flex",
      "items-center",
      "justify-between",
      "gap-2",
      "flex-wrap",
    );
    expect(screen.getByTestId("grade")).toHaveClass(
      "grid",
      "grid-cols-1",
      "sm:grid-cols-2",
      "gap-4",
    );
    expect(screen.getByTestId("grade").tagName).toBe("UL");
  });
});
