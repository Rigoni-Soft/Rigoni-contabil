import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PainelDeEspera } from "./painel-de-espera.component";

const ITENS = [
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

describe("PainelDeEspera", () => {
  it("assumir é clicar no card; o dirigido a outro só informa", async () => {
    const onAssumir = jest.fn();
    render(<PainelDeEspera itens={ITENS} assumindo={false} onAssumir={onAssumir} />);

    const cards = within(screen.getByRole("list", { name: "Clientes em espera" }));
    expect(cards.getAllByRole("listitem")).toHaveLength(2);
    expect(cards.getByText("Dirigido a outro usuário")).toBeInTheDocument();
    expect(cards.getAllByRole("button")).toHaveLength(1);

    await userEvent.click(cards.getByRole("button", { name: /Assumir o atendimento de Maria/ }));
    expect(onAssumir).toHaveBeenCalledWith("a");
  });

  it("o card diz de onde o Atendimento veio e o resumo, e os dois entram na descrição do botão", () => {
    render(
      <PainelDeEspera
        itens={[{ ...ITENS[0], origem: "Transferido de Financeiro por Ana" }]}
        assumindo={false}
        onAssumir={jest.fn()}
      />,
    );

    expect(screen.getByText("Transferido de Financeiro por Ana")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Assumir o atendimento de Maria/ }),
    ).toHaveAccessibleDescription("Transferido de Financeiro por Ana Segunda via do boleto 05:00");
  });

  it("para quem supervisiona, o dirigido a outro abre a leitura e não assume", async () => {
    const onAssumir = jest.fn();
    const onLer = jest.fn();
    render(<PainelDeEspera itens={ITENS} assumindo={false} onAssumir={onAssumir} onLer={onLer} />);

    expect(screen.getByText(/só leitura/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Ler o atendimento de João/ }));
    expect(onLer).toHaveBeenCalledWith("b");
    expect(onAssumir).not.toHaveBeenCalled();
  });

  it("mostra o vazio e o carregando", () => {
    const { rerender } = render(
      <PainelDeEspera itens={[]} assumindo={false} onAssumir={jest.fn()} />,
    );
    expect(screen.getByText("Nenhum cliente em espera.")).toBeInTheDocument();

    rerender(<PainelDeEspera itens={[]} carregando assumindo={false} onAssumir={jest.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Carregando");
  });
});
