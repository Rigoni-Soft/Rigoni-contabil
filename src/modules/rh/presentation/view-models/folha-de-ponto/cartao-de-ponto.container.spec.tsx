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
  empresa: "Teste Ltda",
  competencia: "2026-11",
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
        trabalhadoMin: 0,
        apuracao: {
          normaisMin: 0,
          extras: [],
          bancoDeHorasMin: 0,
          acimaDoLimiteMin: 0,
          noturnoMin: 0,
          atrasoMin: 0,
          faltas: 1,
          abonoDias: 0,
          abonoMin: 0,
          feriadosTrabalhados: 0,
          sabadosTrabalhados: 0,
          diasComLanche: 0,
        },
        batidas: [],
        extra: null,
        abono: false,
      },
    ],
    totalizacao: {
      normaisMin: 0,
      extras: [],
      bancoDeHorasMin: 0,
      acimaDoLimiteMin: 0,
      noturnoMin: 0,
      atrasoMin: 0,
      faltas: 1,
      abonoDias: 0,
      abonoMin: 0,
      feriadosTrabalhados: 0,
      sabadosTrabalhados: 0,
      diasComLanche: 0,
    },
    semConvencao: false,
  },
};

const FOLHA_COM_HORARIO: FolhaDePontoDto = {
  ...FOLHA,
  selecionado: {
    ...FOLHA.selecionado!,
    dias: [
      {
        ...FOLHA.selecionado!.dias[0],
        batidas: [{ entrada: 480, saida: 720 }],
      },
    ],
  },
};

describe("CartaoDePontoContainer", () => {
  beforeEach(() => jest.clearAllMocks());

  it("avisa que vale a legislação quando não há convenção vigente", () => {
    const { rerender } = render(<CartaoDePontoContainer folha={FOLHA} />);
    expect(screen.queryByText(/Sem convenção coletiva vigente/)).toBeNull();

    const sem = { ...FOLHA, selecionado: { ...FOLHA.selecionado!, semConvencao: true } };
    rerender(<CartaoDePontoContainer folha={sem} />);
    expect(screen.getByText(/Sem convenção coletiva vigente/)).toBeInTheDocument();
  });

  it("salvar o dia chama a ação com as batidas em minutos e recarrega a tela", async () => {
    jest.mocked(salvarDiaDoPontoAction).mockResolvedValue({ ok: true, data: undefined });
    render(<CartaoDePontoContainer folha={FOLHA} />);
    const u = userEvent.setup();

    await u.click(screen.getByRole("button", { name: "Editar seg 16/11" }));
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

    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: "Editar seg 16/11" }));
    await u.type(screen.getByLabelText("Entrada 1 de seg 16/11"), "08:00");
    await u.click(screen.getByRole("button", { name: "Salvar seg 16/11" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Preencha entrada e saída");
    expect(salvarDiaDoPontoAction).not.toHaveBeenCalled();
  });

  it("erro do servidor aparece no cartão", async () => {
    jest.mocked(salvarDiaDoPontoAction).mockResolvedValue({
      ok: false,
      error: { code: "forbidden", message: "Sem permissão." },
    } as never);
    render(<CartaoDePontoContainer folha={FOLHA} />);

    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: "Editar seg 16/11" }));
    await u.click(screen.getByRole("button", { name: "Salvar seg 16/11" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Sem permissão.");
  });

  it("rede fora (TypeError) mostra a falta de conexão", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    jest.mocked(salvarDiaDoPontoAction).mockRejectedValue(new TypeError("fetch"));
    render(<CartaoDePontoContainer folha={FOLHA} />);

    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: "Editar seg 16/11" }));
    await u.click(screen.getByRole("button", { name: "Salvar seg 16/11" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Sem conexão com o servidor");
  });

  it("sem empregado escolhido não desenha o cartão", () => {
    const { container } = render(
      <CartaoDePontoContainer folha={{ ...FOLHA, selecionado: null }} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("depois de salvar a linha volta ao lápis, com os campos travados", async () => {
    jest.mocked(salvarDiaDoPontoAction).mockResolvedValue({ ok: true, data: undefined });
    render(<CartaoDePontoContainer folha={FOLHA} />);
    const u = userEvent.setup();

    await u.click(screen.getByRole("button", { name: "Editar seg 16/11" }));
    await u.click(screen.getByRole("button", { name: "Salvar seg 16/11" }));

    expect(await screen.findByRole("button", { name: "Editar seg 16/11" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Salvar seg 16/11" })).not.toBeInTheDocument();
  });

  it("cancelar a linha volta ao estado de antes, com o lápis e o valor salvo", async () => {
    render(<CartaoDePontoContainer folha={FOLHA} />);
    const u = userEvent.setup();

    await u.click(screen.getByRole("button", { name: "Editar seg 16/11" }));
    await u.type(screen.getByLabelText("Entrada 1 de seg 16/11"), "08:00");
    await u.click(screen.getByRole("button", { name: "Cancelar edição de seg 16/11" }));

    expect(screen.getByRole("button", { name: "Editar seg 16/11" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Salvar seg 16/11" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Entrada 1 de seg 16/11")).toHaveValue("");
    expect(salvarDiaDoPontoAction).not.toHaveBeenCalled();
  });

  it("Salvar da tabela grava as linhas abertas, fica na tela e destaca a Totalização", async () => {
    jest.mocked(salvarDiaDoPontoAction).mockResolvedValue({ ok: true, data: undefined });
    render(<CartaoDePontoContainer folha={FOLHA} />);
    const u = userEvent.setup();

    await u.click(screen.getByRole("button", { name: "Editar seg 16/11" }));
    await u.type(screen.getByLabelText("Entrada 1 de seg 16/11"), "08:00");
    await u.type(screen.getByLabelText("Saída 1 de seg 16/11"), "12:00");
    await u.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(salvarDiaDoPontoAction).toHaveBeenCalledWith(
      expect.objectContaining({ data: "2026-11-16", batidas: [{ entrada: 480, saida: 720 }] }),
    );
    expect(await screen.findByText(/A Totalização do mês foi atualizada/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Totalização do mês" })).toHaveClass(
      "border-primary",
    );
    expect(screen.getByRole("button", { name: "Editar seg 16/11" })).toBeInTheDocument();
  });

  it("Limpar da tabela esvazia os campos da linha aberta sem sair da tela", async () => {
    render(<CartaoDePontoContainer folha={FOLHA_COM_HORARIO} />);
    const u = userEvent.setup();

    await u.click(screen.getByRole("button", { name: "Editar seg 16/11" }));
    expect(screen.getByLabelText("Entrada 1 de seg 16/11")).toHaveValue("08:00");
    await u.click(screen.getByRole("button", { name: "Limpar" }));

    expect(screen.getByLabelText("Entrada 1 de seg 16/11")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Salvar seg 16/11" })).toBeInTheDocument();
    expect(salvarDiaDoPontoAction).not.toHaveBeenCalled();
  });

  it("Cancelar da tabela leva de volta à lista de empregados", () => {
    render(<CartaoDePontoContainer folha={FOLHA} />);

    expect(screen.getByRole("link", { name: "Cancelar" })).toHaveAttribute(
      "href",
      "/rh/folha-de-ponto/c1?mes=2026-11",
    );
  });
});
