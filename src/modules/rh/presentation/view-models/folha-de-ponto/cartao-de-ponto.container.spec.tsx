import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { FolhaDePontoDto } from "@/modules/rh/application/dtos/folha-de-ponto.dto";

import { CartaoDePontoContainer } from "./cartao-de-ponto.container";
import { salvarDiaDoPontoAction } from "./folha-de-ponto.actions";

const refresh = jest.fn();

jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
jest.mock("./folha-de-ponto.actions", () => ({ salvarDiaDoPontoAction: jest.fn() }));

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
  competencia: "2026-11",
  quinzena: 2,
  padraoComissionados: false,
  empregados: [ANA],
  podeEditar: true,
  selecionado: {
    empregado: ANA,
    dias: [
      {
        data: "2026-11-16",
        diaDaSemana: 1,
        feriado: false,
        cargaMin: 525,
        batidas: [],
        extra: null,
        abono: false,
      },
    ],
    totalizacao: {
      normaisMin: 0,
      extras50Min: 0,
      extras100Min: 0,
      noturnoMin: 0,
      atrasoMin: 0,
      faltas: 1,
      abonoDias: 0,
      abonoMin: 0,
      feriadosTrabalhados: 0,
    },
  },
};

describe("CartaoDePontoContainer", () => {
  beforeEach(() => jest.clearAllMocks());

  it("salvar o dia chama a ação com as batidas em minutos e recarrega a tela", async () => {
    jest.mocked(salvarDiaDoPontoAction).mockResolvedValue({ ok: true, data: undefined });
    render(<CartaoDePontoContainer folha={FOLHA} />);
    const u = userEvent.setup();

    await u.type(screen.getByLabelText("Entrada 1 de seg 16/11"), "08:00");
    await u.type(screen.getByLabelText("Saída 1 de seg 16/11"), "12:00");
    await u.click(screen.getByRole("button", { name: "Salvar seg 16/11" }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(await screen.findByRole("status")).toHaveTextContent("Salvo.");
    expect(salvarDiaDoPontoAction).toHaveBeenCalledWith({
      empregadoId: "e1",
      data: "2026-11-16",
      batidas: [{ entrada: 480, saida: 720 }],
      extra: null,
      abono: false,
    });
  });

  it("par pela metade mostra o erro sem chamar o servidor", async () => {
    render(<CartaoDePontoContainer folha={FOLHA} />);

    await userEvent.setup().type(screen.getByLabelText("Entrada 1 de seg 16/11"), "08:00");
    await userEvent.setup().click(screen.getByRole("button", { name: "Salvar seg 16/11" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Preencha entrada e saída");
    expect(salvarDiaDoPontoAction).not.toHaveBeenCalled();
  });

  it("erro do servidor aparece no cartão", async () => {
    jest.mocked(salvarDiaDoPontoAction).mockResolvedValue({
      ok: false,
      error: { code: "forbidden", message: "Sem permissão." },
    } as never);
    render(<CartaoDePontoContainer folha={FOLHA} />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Salvar seg 16/11" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Sem permissão.");
  });

  it("rede fora (TypeError) mostra a falta de conexão", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    jest.mocked(salvarDiaDoPontoAction).mockRejectedValue(new TypeError("fetch"));
    render(<CartaoDePontoContainer folha={FOLHA} />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Salvar seg 16/11" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Sem conexão com o servidor");
  });

  it("sem empregado escolhido não desenha o cartão", () => {
    const { container } = render(
      <CartaoDePontoContainer folha={{ ...FOLHA, selecionado: null }} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
