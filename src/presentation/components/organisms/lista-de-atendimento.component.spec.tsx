import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ListaDeAtendimento } from "./lista-de-atendimento.component";

const ESPERA = [
  {
    id: "a",
    contato: "Maria",
    empresa: "Padaria Ltda",
    resumo: "Segunda via do boleto",
    espera: "05:00",
    assumivel: true,
  },
  {
    id: "b",
    contato: "João",
    empresa: "Mercado SA",
    resumo: null,
    espera: "01:00",
    assumivel: false,
  },
];
const CONVERSAS = [{ id: "c", titulo: "Ana", detalhe: "Loja ME", previa: "Oi", aguardando: true }];

function renderizar(props: Partial<React.ComponentProps<typeof ListaDeAtendimento>> = {}) {
  const base = {
    aba: "espera" as const,
    onEscolherAba: jest.fn(),
    espera: ESPERA,
    emAtendimento: CONVERSAS,
    abertoId: null,
    onAbrir: jest.fn(),
    onAssumir: jest.fn(),
    assumindo: false,
  };
  const todas = { ...base, ...props };
  render(<ListaDeAtendimento {...todas} />);
  return todas;
}

describe("ListaDeAtendimento", () => {
  it("mostra as duas abas com o contador de cada uma", () => {
    renderizar();

    expect(screen.getByRole("tab", { name: /Em espera/ })).toHaveTextContent("2");
    expect(screen.getByRole("tab", { name: /Em atendimento/ })).toHaveTextContent("1");
    expect(screen.getByRole("tab", { name: /Em espera/ })).toHaveAttribute("aria-selected", "true");
  });

  it("na espera, assumir é clicar no card; o dirigido a outro só informa", async () => {
    const { onAssumir } = renderizar();

    const cards = within(screen.getByRole("list", { name: "Clientes em espera" }));
    expect(cards.getAllByRole("listitem")).toHaveLength(2);
    expect(cards.getByText("Dirigido a outro usuário")).toBeInTheDocument();
    expect(cards.getAllByRole("button")).toHaveLength(1);

    await userEvent.click(cards.getByRole("button", { name: /Assumir o atendimento de Maria/ }));
    expect(onAssumir).toHaveBeenCalledWith("a");
  });

  it("em atendimento, clicar no card abre a conversa", async () => {
    const { onAbrir } = renderizar({ aba: "atendimento" });

    await userEvent.click(screen.getByRole("button", { name: /Ana/ }));

    expect(onAbrir).toHaveBeenCalledWith("c");
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
});
