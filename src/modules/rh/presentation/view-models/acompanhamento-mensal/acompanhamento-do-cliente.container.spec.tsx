import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AcompanhamentoDoClienteContainer } from "./acompanhamento-do-cliente.container";
import { marcarServicoAction } from "./acompanhamento-mensal.actions";

const refresh = jest.fn();

jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
jest.mock("./acompanhamento-mensal.actions", () => ({
  definirServicoAplicavelAction: jest.fn(),
  marcarServicoAction: jest.fn(),
}));

const PROPS = {
  clienteId: "c1",
  competencia: "2026-11",
  servicos: [{ servicoId: "fgts", nome: "FGTS", estado: "pendente" as const }],
};

describe("AcompanhamentoDoClienteContainer", () => {
  it("a troca de estado chama a ação com o cliente e a competência e recarrega a tela", async () => {
    jest.mocked(marcarServicoAction).mockResolvedValue({ ok: true, data: undefined });
    render(<AcompanhamentoDoClienteContainer {...PROPS} />);

    await userEvent.setup().selectOptions(screen.getByLabelText("FGTS"), "concluido");

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(marcarServicoAction).toHaveBeenCalledWith({
      clienteId: "c1",
      servicoId: "fgts",
      competencia: "2026-11",
      concluido: true,
    });
  });

  it("erro da ação aparece junto do serviço", async () => {
    jest.mocked(marcarServicoAction).mockResolvedValue({
      ok: false,
      error: { code: "forbidden", message: "Sem permissão." },
    } as never);
    render(<AcompanhamentoDoClienteContainer {...PROPS} />);

    await userEvent.setup().selectOptions(screen.getByLabelText("FGTS"), "concluido");

    expect(await screen.findByRole("alert")).toHaveTextContent("Sem permissão.");
  });

  it("rede fora (TypeError) mostra a falta de conexão", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    jest.mocked(marcarServicoAction).mockRejectedValue(new TypeError("fetch"));
    render(<AcompanhamentoDoClienteContainer {...PROPS} />);

    await userEvent.setup().selectOptions(screen.getByLabelText("FGTS"), "concluido");

    expect(await screen.findByRole("alert")).toHaveTextContent("Sem conexão com o servidor");
  });
});
