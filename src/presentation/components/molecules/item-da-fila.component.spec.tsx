import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ItemDaFila } from "./item-da-fila.component";

const base = {
  contato: "Maria",
  empresa: "Padaria Ltda",
  cnpj: null,
  telefone: "(61) 98888-7777",
  resumo: null,
  dirigido: false,
  espera: "00:10",
};

describe("ItemDaFila", () => {
  it("sem ação, o cartão só informa", () => {
    render(<ItemDaFila {...base} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("o botão nomeia o contato e assume ao clicar", async () => {
    const onAssumir = jest.fn();
    render(<ItemDaFila {...base} onAssumir={onAssumir} />);

    await userEvent.click(screen.getByRole("button", { name: "Assumir o atendimento de Maria" }));

    expect(onAssumir).toHaveBeenCalledTimes(1);
  });

  it("enquanto assume, o botão fica bloqueado", () => {
    render(<ItemDaFila {...base} onAssumir={jest.fn()} assumindo />);
    expect(screen.getByRole("button", { name: /Assumir o atendimento de Maria/ })).toBeDisabled();
  });
});
