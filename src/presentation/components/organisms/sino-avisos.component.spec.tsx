import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SinoAvisos } from "./sino-avisos.component";

const NAO_VISTO = {
  id: "a1",
  titulo: "Novo Cliente no Cadastro operacional",
  quando: "22/10/2026, 12:30",
  visto: false,
  href: "/clientes/c1",
};
const VISTO = { ...NAO_VISTO, id: "a2", titulo: "Nova Alteração contratual", visto: true };

function renderizar(props: Partial<React.ComponentProps<typeof SinoAvisos>> = {}) {
  const callbacks = {
    aoAbrir: jest.fn(),
    aoFechar: jest.fn(),
    aoSelecionar: jest.fn(),
    aoCarregarMais: jest.fn(),
    aoTentarDeNovo: jest.fn(),
  };
  render(
    <SinoAvisos
      painelId="avisos"
      contador={0}
      anuncio=""
      avisos={[]}
      estado="pronto"
      temMais={false}
      carregandoMais={false}
      {...callbacks}
      {...props}
    />,
  );
  // O Container abre o <dialog> com showModal (o jsdom não o implementa): aqui ele já nasce aberto.
  document.querySelector("dialog")?.setAttribute("open", "");
  return callbacks;
}

describe("SinoAvisos", () => {
  it("sem avisos não vistos: sem selo e sem destaque", () => {
    renderizar();

    expect(screen.getByRole("button", { name: "Avisos de cadastro" })).toBeInTheDocument();
    expect(screen.queryByTestId("selo-avisos")).not.toBeInTheDocument();
  });

  it("com não vistos: selo com o contador, nome acessível com a quantidade e destaque", () => {
    renderizar({ contador: 3 });

    expect(
      screen.getByRole("button", { name: "Avisos de cadastro, 3 não vistos" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("selo-avisos")).toHaveTextContent("3");
  });

  it("contador acima de 99 vira 99+", () => {
    renderizar({ contador: 250 });

    expect(screen.getByTestId("selo-avisos")).toHaveTextContent("99+");
  });

  it("abrir o sino só avisa o Container; não marca nada", async () => {
    const { aoAbrir, aoSelecionar } = renderizar({ contador: 1 });

    await userEvent.click(screen.getByRole("button", { name: /Avisos de cadastro, 1/ }));

    expect(aoAbrir).toHaveBeenCalledTimes(1);
    expect(aoSelecionar).not.toHaveBeenCalled();
  });

  it("lista: não visto em destaque, visto esmaecido com selo 'visto'", () => {
    renderizar({ contador: 1, avisos: [NAO_VISTO, VISTO] });

    const naoVisto = screen.getByRole("button", { name: /Novo Cliente no Cadastro operacional/ });
    const visto = screen.getByRole("button", { name: /Nova Alteração contratual/ });
    expect(naoVisto).toHaveAttribute("data-visto", "false");
    expect(visto).toHaveAttribute("data-visto", "true");
    expect(visto).toHaveTextContent("visto");
    expect(naoVisto).not.toHaveTextContent(/\bvisto\b/);
  });

  it("clicar no aviso entrega o aviso ao Container", async () => {
    const { aoSelecionar } = renderizar({ contador: 1, avisos: [NAO_VISTO] });

    await userEvent.click(screen.getByRole("button", { name: /Novo Cliente/ }));

    expect(aoSelecionar).toHaveBeenCalledWith(NAO_VISTO);
  });

  it("'Carregar mais' só aparece com próxima página e chama o Container", async () => {
    const { aoCarregarMais } = renderizar({ avisos: [NAO_VISTO], temMais: true });

    await userEvent.click(screen.getByRole("button", { name: "Carregar mais" }));

    expect(aoCarregarMais).toHaveBeenCalledTimes(1);
  });

  it("sem próxima página não há 'Carregar mais'", () => {
    renderizar({ avisos: [NAO_VISTO] });

    expect(screen.queryByRole("button", { name: "Carregar mais" })).not.toBeInTheDocument();
  });

  it("lista vazia tem mensagem própria", () => {
    renderizar();

    expect(screen.getByText("Nenhum aviso de cadastro.")).toBeInTheDocument();
  });

  it("o anúncio recebido é lido pela região de status", () => {
    renderizar({ contador: 3, anuncio: "3 avisos de cadastro não vistos" });

    expect(screen.getByRole("status")).toHaveTextContent("3 avisos de cadastro não vistos");
  });

  it("sem anúncio a região de status fica vazia", () => {
    renderizar({ contador: 3 });

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("o modal se nomeia pelo título", () => {
    renderizar();

    expect(screen.getByRole("dialog", { name: "Avisos de cadastro" })).toBeInTheDocument();
  });

  it("o botão Fechar chama o Container", async () => {
    const { aoFechar } = renderizar();

    await userEvent.click(screen.getByRole("button", { name: "Fechar avisos" }));

    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  it("o véu fecha o modal por light dismiss nativo", () => {
    renderizar();

    expect(screen.getByRole("dialog")).toHaveAttribute("closedby", "any");
  });

  it("erro de leitura oferece 'Tentar de novo'", async () => {
    const { aoTentarDeNovo } = renderizar({ estado: "erro" });

    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(aoTentarDeNovo).toHaveBeenCalledTimes(1);
  });

  it("erro de leitura avisa sem apagar o que já estava na lista", () => {
    renderizar({ avisos: [NAO_VISTO], estado: "erro" });

    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível carregar os avisos.");
    expect(screen.getByRole("button", { name: /Novo Cliente/ })).toBeInTheDocument();
  });
});
