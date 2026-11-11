import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { FolhaDePontoDto } from "@/modules/rh/application/dtos/folha-de-ponto.dto";

import {
  cadastrarEmpregadoAction,
  corrigirEmpregadoAction,
  definirEmpregadoAtivoAction,
  definirPadraoComissionadosAction,
  definirSemMovimentoAction,
} from "./folha-de-ponto.actions";
import { QuadroDeFuncionariosContainer } from "./quadro-de-funcionarios.container";

const refresh = jest.fn();

jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
jest.mock("./folha-de-ponto.actions", () => ({
  cadastrarEmpregadoAction: jest.fn(),
  corrigirEmpregadoAction: jest.fn(),
  definirEmpregadoAtivoAction: jest.fn(),
  definirPadraoComissionadosAction: jest.fn(),
  definirSemMovimentoAction: jest.fn(),
}));

const ANA = {
  id: "e1",
  nome: "Ana",
  jornada: [0, 525, 525, 525, 525, 525, 240],
  comissionado: false,
  ativo: true,
  semMovimento: false,
};
const FOLHA: FolhaDePontoDto = {
  clienteId: "c1",
  empresa: "Teste Ltda",
  competencia: "2026-11",
  padraoComissionados: false,
  empregados: [ANA],
  podeEditar: true,
  selecionado: {
    empregado: ANA,
    dias: [],
    totalizacao: {} as never,
    iniciado: false,
    semConvencao: false,
  },
};
// Sem empregado escolhido a tela mostra o formulário "Novo empregado".
const SEM_ESCOLHA: FolhaDePontoDto = { ...FOLHA, selecionado: null };
const OK = { ok: true as const, data: undefined };

describe("QuadroDeFuncionariosContainer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const acao of [
      cadastrarEmpregadoAction,
      corrigirEmpregadoAction,
      definirEmpregadoAtivoAction,
      definirPadraoComissionadosAction,
      definirSemMovimentoAction,
    ]) {
      jest.mocked(acao).mockResolvedValue(OK);
    }
  });

  it("cadastra o empregado com a Jornada padrão em minutos e recarrega a tela", async () => {
    render(<QuadroDeFuncionariosContainer folha={SEM_ESCOLHA} />);
    const novo = screen.getByRole("form", { name: "Novo empregado" });

    await userEvent.setup().type(novo.querySelector("input[name=nome]")!, "Caio");
    await userEvent.setup().click(screen.getByRole("button", { name: "Cadastrar empregado" }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(cadastrarEmpregadoAction).toHaveBeenCalledWith({
      clienteId: "c1",
      nome: "Caio",
      jornada: [0, 525, 525, 525, 525, 525, 240],
      comissionado: false,
    });
  });

  it("inativa, marca sem movimento e liga o padrão do cliente", async () => {
    render(<QuadroDeFuncionariosContainer folha={FOLHA} />);
    const u = userEvent.setup();

    await u.click(screen.getByRole("button", { name: "Desligar da empresa" }));
    await u.click(screen.getByRole("checkbox", { name: "Sem movimento em novembro de 2026" }));
    await u.click(screen.getByRole("checkbox", { name: /são comissionados/ }));

    await waitFor(() => expect(definirPadraoComissionadosAction).toHaveBeenCalled());
    expect(definirEmpregadoAtivoAction).toHaveBeenCalledWith({ empregadoId: "e1", ativo: false });
    expect(definirSemMovimentoAction).toHaveBeenCalledWith({
      empregadoId: "e1",
      competencia: "2026-11",
      sem: true,
    });
    expect(definirPadraoComissionadosAction).toHaveBeenCalledWith({
      clienteId: "c1",
      comissionados: true,
    });
  });

  it("com empregado escolhido o Editar substitui o Novo e a lista leva ao cartão", () => {
    render(<QuadroDeFuncionariosContainer folha={FOLHA} />);

    expect(screen.queryByRole("form", { name: "Novo empregado" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cartão de ponto de Ana" })).toHaveAttribute(
      "href",
      "/rh/folha-de-ponto/c1/cartao/e1?mes=2026-11",
    );
    expect(screen.getByRole("link", { name: "Novo empregado" })).toHaveAttribute(
      "href",
      "/rh/folha-de-ponto/c1?mes=2026-11",
    );
  });

  it("corrige o empregado escolhido", async () => {
    render(<QuadroDeFuncionariosContainer folha={FOLHA} />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Salvar empregado" }));

    await waitFor(() => expect(corrigirEmpregadoAction).toHaveBeenCalled());
    expect(corrigirEmpregadoAction).toHaveBeenCalledWith(
      expect.objectContaining({ empregadoId: "e1", nome: "Ana" }),
    );
  });

  it("erro do servidor e rede fora aparecem no quadro", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    jest.mocked(definirEmpregadoAtivoAction).mockResolvedValueOnce({
      ok: false,
      error: { code: "forbidden", message: "Sem permissão." },
    } as never);
    render(<QuadroDeFuncionariosContainer folha={FOLHA} />);
    const u = userEvent.setup();

    await u.click(screen.getByRole("button", { name: "Desligar da empresa" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Sem permissão.");

    jest.mocked(definirEmpregadoAtivoAction).mockRejectedValueOnce(new TypeError("fetch"));
    await u.click(screen.getByRole("button", { name: "Desligar da empresa" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Sem conexão com o servidor");
  });

  it("recusa do servidor no cadastro preserva o nome digitado", async () => {
    jest.mocked(cadastrarEmpregadoAction).mockResolvedValueOnce({
      ok: false,
      error: { code: "forbidden", message: "Sem permissão." },
    } as never);
    render(<QuadroDeFuncionariosContainer folha={SEM_ESCOLHA} />);
    const campoNome = screen
      .getByRole("form", { name: "Novo empregado" })
      .querySelector<HTMLInputElement>("input[name=nome]")!;

    await userEvent.setup().type(campoNome, "Caio");
    await userEvent.setup().click(screen.getByRole("button", { name: "Cadastrar empregado" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Sem permissão.");
    expect(campoNome).toHaveValue("Caio");
  });
});
