import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { criarServicoAction, desativarServicoAction } from "./acompanhamento-mensal.actions";
import { ServicosDoAcompanhamentoContainer } from "./servicos-do-acompanhamento.container";

const refresh = jest.fn();

jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
jest.mock("./acompanhamento-mensal.actions", () => ({
  criarServicoAction: jest.fn(),
  desativarServicoAction: jest.fn(),
  renomearServicoAction: jest.fn(),
}));

const SERVICOS = [
  { id: "fgts", nome: "FGTS", sistema: false },
  { id: "holerite", nome: "Holerite", sistema: true },
];

describe("ServicosDoAcompanhamentoContainer", () => {
  it("cadastrar chama a ação com o nome e recarrega a lista", async () => {
    jest.mocked(criarServicoAction).mockResolvedValue({ ok: true, data: undefined });
    render(<ServicosDoAcompanhamentoContainer servicos={SERVICOS} />);
    const usuario = userEvent.setup();

    await usuario.type(screen.getByLabelText("Novo serviço"), "Contribuição");
    await usuario.click(screen.getByRole("button", { name: "Cadastrar serviço" }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(criarServicoAction).toHaveBeenCalledWith({ nome: "Contribuição" });
  });

  it("desativar pede confirmação e o erro da ação aparece", async () => {
    jest.mocked(desativarServicoAction).mockResolvedValue({
      ok: false,
      error: { code: "forbidden", message: "Sem permissão." },
    } as never);
    render(<ServicosDoAcompanhamentoContainer servicos={SERVICOS} />);
    const usuario = userEvent.setup();

    await usuario.click(screen.getByRole("button", { name: "Desativar FGTS" }));
    expect(desativarServicoAction).not.toHaveBeenCalled();
    await usuario.click(screen.getByRole("button", { name: "Confirmar desativação de FGTS" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Sem permissão.");
    expect(desativarServicoAction).toHaveBeenCalledWith({ servicoId: "fgts" });
  });
});
