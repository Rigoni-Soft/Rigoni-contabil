import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PainelDoChat } from "./painel-do-chat.component";

describe("PainelDoChat", () => {
  it("sem conversa aberta, convida a escolher uma e não oferece voltar", () => {
    render(<PainelDoChat estado="vazio" onVoltar={jest.fn()} />);

    expect(screen.getByText("Escolha um atendimento para conversar.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Voltar à lista/ })).toBeNull();
  });

  it("pronto, mostra o chat e deixa voltar à lista", async () => {
    const onVoltar = jest.fn();
    render(
      <PainelDoChat estado="pronto" onVoltar={onVoltar}>
        <p>mensagens</p>
      </PainelDoChat>,
    );

    expect(screen.getByText("mensagens")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Voltar à lista/ }));
    expect(onVoltar).toHaveBeenCalled();
  });

  it.each([
    ["abrindo", "status", "Abrindo a conversa"],
    ["erro", "alert", "Não foi possível abrir a conversa"],
  ] as const)("%s avisa", (estado, papel, texto) => {
    render(<PainelDoChat estado={estado} onVoltar={jest.fn()} />);

    expect(screen.getByRole(papel)).toHaveTextContent(texto);
  });
});
