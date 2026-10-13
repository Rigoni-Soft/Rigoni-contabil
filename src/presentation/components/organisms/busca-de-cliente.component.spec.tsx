import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BuscaDeCliente } from "./busca-de-cliente.component";
import { PainelDoCliente } from "./painel-do-cliente.component";
import { ResultadoDoFeed } from "./resultado-do-feed.component";

const BASE = {
  termo: "pad",
  onTermoChange: jest.fn(),
  onKeyDown: jest.fn(),
  buscando: false,
  sugestoes: [{ id: "1", empresa: "Padaria", cnpj: "11.444.777/0001-61" }],
  indiceAtivo: 0,
  onDestacar: jest.fn(),
  onSelecionar: jest.fn(),
  idLista: "lista",
  idOpcao: (i: number) => `opcao-${i}`,
};

describe("BuscaDeCliente", () => {
  it("combobox expandido com a lista; escolher entrega o id", async () => {
    const aoSelecionar = jest.fn();
    render(<BuscaDeCliente {...BASE} onSelecionar={aoSelecionar} />);

    expect(screen.getByRole("combobox", { name: "Empresa ou CNPJ" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("status")).toHaveTextContent("1 sugestão encontrada.");
    await userEvent.setup().click(screen.getByRole("option", { name: /Padaria/ }));

    expect(aoSelecionar).toHaveBeenCalledWith("1");
  });

  it("buscando mostra o aviso e não a lista", () => {
    render(<BuscaDeCliente {...BASE} buscando sugestoes={[]} indiceAtivo={null} />);

    expect(screen.getAllByText("Buscando...").length).toBeGreaterThan(0);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});

describe("PainelDoCliente", () => {
  it("mostra o título focável e a ação 'Nova busca'", async () => {
    const aoNovaBusca = jest.fn();
    render(
      <PainelDoCliente
        titulo="Editar cadastro operacional"
        tituloRef={null}
        onNovaBusca={aoNovaBusca}
      >
        <p>formulário</p>
      </PainelDoCliente>,
    );

    expect(screen.getByRole("heading", { name: "Editar cadastro operacional" })).toHaveAttribute(
      "tabindex",
      "-1",
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "Nova busca" }));
    expect(aoNovaBusca).toHaveBeenCalled();
  });
});

describe("ResultadoDoFeed", () => {
  it("erro acima da lista e estado ocupado enquanto carrega", () => {
    const { container } = render(
      <ResultadoDoFeed registros={[]} carregando erro="Falha ao carregar." />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Falha ao carregar.");
    expect(container.querySelector("[aria-busy='true']")).toBeInTheDocument();
  });
});
