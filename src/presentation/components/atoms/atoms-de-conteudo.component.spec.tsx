import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AnelDeProgresso } from "./anel-de-progresso.component";
import { Balao } from "./balao.component";
import { BotaoDeEmoji } from "./botao-de-emoji.component";
import { CabecalhoDeColuna, CelulaDeTabela } from "./celula-de-tabela.component";
import { ChipDeSetor } from "./chip-de-setor.component";
import { HoraDaMensagem } from "./hora-da-mensagem.component";
import { IconeDeConversa } from "./icone-de-conversa.component";
import { LinkDeVoltar } from "./link-de-voltar.component";
import { ListaComDivisores } from "./lista-com-divisores.component";
import { NotaDeObrigatorio } from "./nota-de-obrigatorio.component";
import { NumeroEmCirculo } from "./numero-em-circulo.component";
import { ReacaoEmPilula } from "./reacao-em-pilula.component";
import { SecaoComDivisor } from "./secao-com-divisor.component";
import { SeloDeResultado } from "./selo-de-resultado.component";
import { TempoDeEspera } from "./tempo-de-espera.component";
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

  it("ListaComDivisores é uma lista; ChipDeSetor vira link com href e span desabilitado sem", () => {
    render(
      <ListaComDivisores cartao>
        <li>
          <ChipDeSetor href="/simples-nacional">Simples Nacional</ChipDeSetor>
        </li>
        <li>
          <ChipDeSetor>Contábil</ChipDeSetor>
        </li>
      </ListaComDivisores>,
    );

    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Simples Nacional" })).toHaveAttribute(
      "href",
      "/simples-nacional",
    );
    expect(screen.getByText("Contábil")).toHaveAttribute("aria-disabled", "true");
  });

  it("NumeroEmCirculo e TempoDeEspera dizem o contexto para leitor de tela", () => {
    render(
      <>
        <NumeroEmCirculo valor={3} prefixo="Posição" />
        <TempoDeEspera valor="5 min" />
      </>,
    );

    expect(screen.getByText("Posição")).toHaveClass("sr-only");
    expect(screen.getByText("Esperando há")).toHaveClass("sr-only");
    expect(screen.getByText("5 min")).toBeInTheDocument();
  });

  it("Balao, Reação e Hora compõem uma Mensagem", () => {
    render(
      <ul>
        <Balao lado="contato" acao={<button type="button">reagir</button>}>
          <ReacaoEmPilula emoji="👍" />
          <HoraDaMensagem hora="08/10 12:30" />
        </Balao>
      </ul>,
    );

    expect(screen.getByRole("img", { name: "Reação do escritório: 👍" })).toBeInTheDocument();
    expect(screen.getByText("08/10 12:30")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "reagir" })).toBeInTheDocument();
  });

  it("BotaoDeEmoji entrega o emoji ao clicar", async () => {
    const aoEscolher = jest.fn();
    render(<BotaoDeEmoji emoji="👍" nome="Joinha" onEscolher={aoEscolher} />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Joinha" }));

    expect(aoEscolher).toHaveBeenCalledWith("👍");
  });

  it("tabela: cabeçalho de coluna tem scope e SeloDeResultado traz texto com cor de estado", () => {
    render(
      <table>
        <thead>
          <tr>
            <CabecalhoDeColuna>Resultado</CabecalhoDeColuna>
          </tr>
        </thead>
        <tbody>
          <tr>
            <CelulaDeTabela>
              <SeloDeResultado resultado="falha_compensacao" />
            </CelulaDeTabela>
          </tr>
        </tbody>
      </table>,
    );

    expect(screen.getByRole("columnheader", { name: "Resultado" })).toHaveAttribute("scope", "col");
    expect(screen.getByText("falha_compensacao")).toHaveClass("text-destructive");
  });

  it("AnelDeProgresso mostra a quantidade; IconeDeConversa só mostra ponto quando aguardando", () => {
    const { container, rerender } = render(
      <>
        <AnelDeProgresso quantidade={7} total={10} classe="stroke-primary" />
        <IconeDeConversa />
      </>,
    );
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(container.querySelector(".bg-destructive")).not.toBeInTheDocument();

    rerender(<IconeDeConversa aguardando />);
    expect(container.querySelector(".bg-destructive")).toBeInTheDocument();
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
