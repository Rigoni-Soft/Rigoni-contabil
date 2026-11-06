import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ListaDeAtendimento } from "./lista-de-atendimento.component";

function renderizar(props: Partial<React.ComponentProps<typeof ListaDeAtendimento>> = {}) {
  const onEscolherAba = jest.fn();
  render(
    <ListaDeAtendimento
      aba="espera"
      onEscolherAba={onEscolherAba}
      contadores={{ espera: 2, atendimento: 1 }}
      {...props}
    >
      <p>painel da aba</p>
    </ListaDeAtendimento>,
  );
  return { onEscolherAba };
}

describe("ListaDeAtendimento", () => {
  it("mostra as duas abas com o contador de cada uma e o painel da ativa", () => {
    renderizar();

    expect(screen.getByRole("tab", { name: /Em espera/ })).toHaveTextContent("2");
    expect(screen.getByRole("tab", { name: /Em atendimento/ })).toHaveTextContent("1");
    expect(screen.getByRole("tab", { name: /Em espera/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("painel da aba");
  });

  it("trocar de aba avisa a tela", async () => {
    const { onEscolherAba } = renderizar();

    await userEvent.click(screen.getByRole("tab", { name: /Em atendimento/ }));

    expect(onEscolherAba).toHaveBeenCalledWith("atendimento");
  });

  it("mostra o aviso de 'já assumido'", () => {
    renderizar({ aviso: "Atendimento já assumido por outra pessoa." });

    expect(screen.getByRole("alert")).toHaveTextContent("já assumido");
  });

  it("só o Admin vê o seletor de Setor", () => {
    renderizar({
      escolhaDeSetor: {
        setor: "financeiro",
        opcoes: [{ valor: "financeiro", rotulo: "Financeiro" }],
        onChange: jest.fn(),
      },
    });

    expect(screen.getByRole("combobox", { name: "Setor" })).toBeInTheDocument();
  });

  it("anuncia cliente novo ao leitor de tela numa região de status", () => {
    renderizar({ anuncio: "Novo cliente em espera. Total na espera: 3." });

    expect(screen.getByRole("status")).toHaveTextContent("Novo cliente em espera");
  });
});
