import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { ConvencoesDoClienteDto } from "@/modules/rh/application/dtos/convencao.dto";

import { AjustesDoClienteNaConvencaoContainer } from "./ajustes-do-cliente-na-convencao.container";
import { definirConvencaoDoEmpregadoAction, definirInterruptoresAction } from "./convencao.actions";

const refresh = jest.fn();

jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
jest.mock("./convencao.actions", () => ({
  definirConvencaoDoEmpregadoAction: jest.fn(),
  definirInterruptoresAction: jest.fn(),
}));

const CONVENCAO = {
  vigenciaInicio: "2026-05-01",
  vigenciaFim: "2027-04-30",
  arquivoNome: "cct.pdf",
  enviadaEm: "2026-11-11",
  regras: { versao: 1, aplicadas: [], rejeitadas: [] },
};
const DADOS: ConvencoesDoClienteDto = {
  clienteId: "c1",
  convencoes: [
    { ...CONVENCAO, id: "cv1", sindicato: "Comércio" },
    { ...CONVENCAO, id: "cv2", sindicato: "Escritórios" },
  ],
  interruptores: { bancoDeHoras: false, trabalhoAosDomingos: true },
  empregados: [{ id: "e1", nome: "Ana", convencaoSindicato: null }],
  podeEnviar: false,
  podeEditar: true,
};
const OK = { ok: true as const, data: undefined };

describe("AjustesDoClienteNaConvencaoContainer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(definirInterruptoresAction).mockResolvedValue(OK);
    jest.mocked(definirConvencaoDoEmpregadoAction).mockResolvedValue(OK);
  });

  it("liga o banco de horas sem mexer no outro interruptor e recarrega a tela", async () => {
    render(<AjustesDoClienteNaConvencaoContainer dados={DADOS} />);

    await userEvent.setup().click(screen.getByRole("checkbox", { name: "Banco de horas" }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(definirInterruptoresAction).toHaveBeenCalledWith({
      clienteId: "c1",
      bancoDeHoras: true,
      trabalhoAosDomingos: true,
    });
  });

  it("aponta o empregado para a convenção do sindicato escolhido", async () => {
    render(<AjustesDoClienteNaConvencaoContainer dados={DADOS} />);

    await userEvent.setup().selectOptions(screen.getByLabelText("Ana"), "Escritórios");

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(definirConvencaoDoEmpregadoAction).toHaveBeenCalledWith({
      empregadoId: "e1",
      sindicato: "Escritórios",
    });
  });

  it("a escolha vazia devolve o empregado à única convenção (nulo)", async () => {
    const dados = {
      ...DADOS,
      empregados: [{ id: "e1", nome: "Ana", convencaoSindicato: "Comércio" }],
    };
    render(<AjustesDoClienteNaConvencaoContainer dados={dados} />);

    await userEvent.setup().selectOptions(screen.getByLabelText("Ana"), "");

    await waitFor(() =>
      expect(definirConvencaoDoEmpregadoAction).toHaveBeenCalledWith({
        empregadoId: "e1",
        sindicato: null,
      }),
    );
  });

  it("com uma convenção só, não pergunta a convenção de cada empregado", () => {
    render(
      <AjustesDoClienteNaConvencaoContainer
        dados={{ ...DADOS, convencoes: [DADOS.convencoes[0]] }}
      />,
    );

    expect(screen.queryByLabelText("Ana")).not.toBeInTheDocument();
  });

  it("em leitura, desabilita os controles e diz quem altera", () => {
    render(<AjustesDoClienteNaConvencaoContainer dados={{ ...DADOS, podeEditar: false }} />);

    expect(screen.getByRole("checkbox", { name: "Banco de horas" })).toBeDisabled();
    expect(screen.getByLabelText("Ana")).toBeDisabled();
    expect(screen.getByText(/Só o Responsável do RH deste cliente/)).toBeInTheDocument();
  });

  it("mostra a recusa do servidor", async () => {
    jest.mocked(definirInterruptoresAction).mockResolvedValue({
      ok: false,
      error: { code: "FORBIDDEN", message: "Você não pode alterar a Folha de ponto." },
    });
    render(<AjustesDoClienteNaConvencaoContainer dados={DADOS} />);

    await userEvent.setup().click(screen.getByRole("checkbox", { name: "Banco de horas" }));

    expect(await screen.findByText("Você não pode alterar a Folha de ponto.")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});
