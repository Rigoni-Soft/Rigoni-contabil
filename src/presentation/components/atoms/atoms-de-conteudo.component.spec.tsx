import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AnelDeProgresso } from "./anel-de-progresso.component";
import { BotaoDeEmoji } from "./botao-de-emoji.component";
import { CabecalhoDeColuna, CelulaDeTabela } from "./celula-de-tabela.component";
import { DonutSvg } from "./donut-svg.component";
import { LinkDeVoltar } from "./link-de-voltar.component";
import { ListaComDivisores } from "./lista-com-divisores.component";
import { NotaDeObrigatorio } from "./nota-de-obrigatorio.component";
import { SecaoComDivisor } from "./secao-com-divisor.component";
import { Texto } from "./texto.component";

describe("átomos de conteúdo", () => {
  it("Texto usa o elemento pedido e aplica o papel tipográfico", () => {
    render(
      <Texto como="h1" variante="tela">
        Título
      </Texto>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Título" })).toHaveClass("text-primary");
  });

  it("ListaComDivisores tem role=list explícito", () => {
    render(
      <ListaComDivisores>
        <li>x</li>
      </ListaComDivisores>,
    );

    expect(screen.getByRole("list")).toHaveAttribute("role", "list");
  });

  it("ListaComDivisores é uma lista", () => {
    render(
      <ListaComDivisores cartao>
        <li>item</li>
      </ListaComDivisores>,
    );

    expect(screen.getByRole("list")).toBeInTheDocument();
  });

  it("BotaoDeEmoji entrega o emoji ao clicar", async () => {
    const aoEscolher = jest.fn();
    render(<BotaoDeEmoji emoji="👍" nome="Joinha" onEscolher={aoEscolher} />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Joinha" }));

    expect(aoEscolher).toHaveBeenCalledWith("👍");
  });

  it("cabeçalho de coluna tem scope", () => {
    render(
      <table>
        <thead>
          <tr>
            <CabecalhoDeColuna>Resultado</CabecalhoDeColuna>
          </tr>
        </thead>
        <tbody>
          <tr>
            <CelulaDeTabela numerica>08/10</CelulaDeTabela>
          </tr>
        </tbody>
      </table>,
    );

    expect(screen.getByRole("columnheader", { name: "Resultado" })).toHaveAttribute("scope", "col");
  });

  it("AnelDeProgresso e DonutSvg mostram o número no centro", () => {
    render(
      <>
        <AnelDeProgresso quantidade={7} total={10} classe="stroke-primary" />
        <DonutSvg fatias={[{ id: "enviado", rotulo: "Enviado", quantidade: 4 }]} />
      </>,
    );

    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("LinkDeVoltar, NotaDeObrigatorio e SecaoComDivisor", () => {
    render(
      <>
        <LinkDeVoltar href="/atras" />
        <NotaDeObrigatorio />
        <SecaoComDivisor>
          <p>seção</p>
        </SecaoComDivisor>
      </>,
    );

    expect(screen.getByRole("link", { name: "Voltar" })).toHaveAttribute("href", "/atras");
    expect(screen.getByText(/são obrigatórios/)).toBeInTheDocument();
    expect(screen.getByText("seção")).toBeInTheDocument();
  });
});
