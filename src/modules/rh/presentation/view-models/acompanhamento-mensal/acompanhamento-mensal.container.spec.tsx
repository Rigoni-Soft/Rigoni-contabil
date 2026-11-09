import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { marcarServicoAction } from "./acompanhamento-mensal.actions";
import { AcompanhamentoMensalContainer } from "./acompanhamento-mensal.container";

const refresh = jest.fn();

jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
jest.mock("./acompanhamento-mensal.actions", () => ({
  criarServicoAction: jest.fn(),
  definirServicoAplicavelAction: jest.fn(),
  desativarServicoAction: jest.fn(),
  marcarServicoAction: jest.fn(),
  renomearServicoAction: jest.fn(),
}));

const PROPS = {
  competencia: "2026-11",
  rotuloCompetencia: "novembro de 2026",
  anteriorHref: "?mes=2026-10",
  servicos: [{ id: "fgts", nome: "FGTS", sistema: false }],
  linhas: [
    {
      clienteId: "c1",
      empresa: "Padaria Sol",
      cnpj: "11444777000161",
      celulas: [{ servicoId: "fgts", estado: "pendente" as const }],
      pendentes: 1,
    },
  ],
  podeGerirServicos: false,
};

describe("AcompanhamentoMensalContainer", () => {
  it("a View recebe as linhas e a troca de estado chama a ação e recarrega a tela", async () => {
    jest.mocked(marcarServicoAction).mockResolvedValue({ ok: true, data: undefined });
    render(<AcompanhamentoMensalContainer {...PROPS} />);

    await userEvent
      .setup()
      .selectOptions(screen.getByRole("combobox", { name: "FGTS de Padaria Sol" }), "concluido");

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(marcarServicoAction).toHaveBeenCalledWith({
      clienteId: "c1",
      servicoId: "fgts",
      competencia: "2026-11",
      concluido: true,
    });
  });

  it("erro da ação aparece junto da tabela", async () => {
    jest
      .mocked(marcarServicoAction)
      .mockResolvedValue({
        ok: false,
        error: { code: "forbidden", message: "Sem permissão." },
      } as never);
    render(<AcompanhamentoMensalContainer {...PROPS} />);

    await userEvent
      .setup()
      .selectOptions(screen.getByRole("combobox", { name: "FGTS de Padaria Sol" }), "concluido");

    expect(await screen.findByRole("alert")).toHaveTextContent("Sem permissão.");
  });
});
