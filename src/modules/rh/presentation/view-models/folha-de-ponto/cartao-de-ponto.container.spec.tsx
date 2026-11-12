import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { FolhaDePontoDto } from "@/modules/rh/application/dtos/folha-de-ponto.dto";

import { CartaoDePontoContainer } from "./cartao-de-ponto.container";
import {
  iniciarCartaoDoPontoAction,
  lerAtestadoDePontoAction,
  salvarDiaDoPontoAction,
} from "./folha-de-ponto.actions";

const refresh = jest.fn();

jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
jest.mock("./folha-de-ponto.actions", () => ({
  salvarDiaDoPontoAction: jest.fn(),
  iniciarCartaoDoPontoAction: jest.fn(),
  lerAtestadoDePontoAction: jest.fn(),
}));

const ZERO = {
  normaisMin: 0,
  extras: [],
  bancoDeHorasMin: 0,
  acimaDoLimiteMin: 0,
  noturnoMin: 0,
  atrasoMin: 0,
  faltas: 0,
  abonoDias: 0,
  abonoMin: 0,
  feriadosTrabalhados: 0,
  sabadosTrabalhados: 0,
  diasComLanche: 0,
};
const ANA = {
  id: "e1",
  nome: "Ana",
  jornada: [0, 525, 525, 525, 525, 525, 240] as const,
  comissionado: false,
  ativo: true,
  semMovimento: false,
};
// Cartão sem nenhum dado salvo (mês novo): abre com todas as linhas já editáveis.
const FOLHA_VAZIA: FolhaDePontoDto = {
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
    iniciado: false,
    semConvencao: false,
  },
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
      // Outro dia já lançado: o cartão foi começado e o dia 16, vazio, é falta.
      {
        data: "2026-11-17",
        diaDaSemana: 2,
        feriado: false,
        cargaMin: 525,
        trabalhadoMin: 525,
        apuracao: { ...ZERO, normaisMin: 525 },
        batidas: [{ entrada: 480, saida: 1005 }],
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
    iniciado: false,
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

  it("Abonar troca a falta por abonada: grava o dia só com o Abono e recarrega", async () => {
    jest.mocked(salvarDiaDoPontoAction).mockResolvedValue({ ok: true, data: undefined });
    render(<CartaoDePontoContainer folha={FOLHA} />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Abonar seg 16/11" }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(salvarDiaDoPontoAction).toHaveBeenCalledWith({
      empregadoId: "e1",
      data: "2026-11-16",
      batidas: [],
      extra: null,
      abono: true,
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Abonado.");
  });

  it("Cancelar da tabela leva de volta à lista de empregados", () => {
    render(<CartaoDePontoContainer folha={FOLHA} />);

    expect(screen.getByRole("link", { name: "Cancelar" })).toHaveAttribute(
      "href",
      "/rh/folha-de-ponto/c1?mes=2026-11",
    );
  });

  it("cartão novo abre com todas as linhas editáveis, sem um lápis por dia", () => {
    render(<CartaoDePontoContainer folha={FOLHA_VAZIA} />);

    expect(screen.getByLabelText("Entrada 1 de seg 16/11")).toBeEnabled();
    expect(screen.getByRole("button", { name: "Salvar seg 16/11" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar seg 16/11" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Abonar/ })).not.toBeInTheDocument();
  });

  it("cartão novo: Salvar da tabela grava só os dias digitados", async () => {
    jest.mocked(iniciarCartaoDoPontoAction).mockResolvedValue({ ok: true, data: undefined });
    jest.mocked(salvarDiaDoPontoAction).mockResolvedValue({ ok: true, data: undefined });
    const dois = {
      ...FOLHA_VAZIA,
      selecionado: {
        ...FOLHA_VAZIA.selecionado!,
        dias: [
          FOLHA_VAZIA.selecionado!.dias[0],
          { ...FOLHA_VAZIA.selecionado!.dias[0], data: "2026-11-17", diaDaSemana: 2 },
        ],
      },
    };
    render(<CartaoDePontoContainer folha={dois} />);
    const u = userEvent.setup();

    await u.type(screen.getByLabelText("Entrada 1 de seg 16/11"), "08:00");
    await u.type(screen.getByLabelText("Saída 1 de seg 16/11"), "12:00");
    await u.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(salvarDiaDoPontoAction).toHaveBeenCalledTimes(1);
    expect(salvarDiaDoPontoAction).toHaveBeenCalledWith(
      expect.objectContaining({ data: "2026-11-16" }),
    );
  });

  it("cartão já começado: o dia útil vazio é falta, com horários travados até o lápis", () => {
    render(<CartaoDePontoContainer folha={FOLHA} />);

    expect(screen.getByLabelText("Entrada 1 de seg 16/11")).toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "Editar seg 16/11" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abonar seg 16/11" })).toBeInTheDocument();
  });

  it("Desfazer abono grava o dia vazio, sem Abono", async () => {
    jest.mocked(salvarDiaDoPontoAction).mockResolvedValue({ ok: true, data: undefined });
    const abonado = {
      ...FOLHA,
      selecionado: {
        ...FOLHA.selecionado!,
        dias: [{ ...FOLHA.selecionado!.dias[0], abono: true }, FOLHA.selecionado!.dias[1]],
      },
    };
    render(<CartaoDePontoContainer folha={abonado} />);

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Desfazer abono de seg 16/11" }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(salvarDiaDoPontoAction).toHaveBeenCalledWith({
      empregadoId: "e1",
      data: "2026-11-16",
      batidas: [],
      extra: null,
      abono: false,
    });
  });

  it("o foco acompanha a ação: lápis abre no primeiro campo; cancelar devolve o foco ao lápis", async () => {
    render(<CartaoDePontoContainer folha={FOLHA} />);
    const u = userEvent.setup();

    await u.click(screen.getByRole("button", { name: "Editar seg 16/11" }));
    expect(screen.getByLabelText("Entrada 1 de seg 16/11")).toHaveFocus();

    await u.click(screen.getByRole("button", { name: "Cancelar edição de seg 16/11" }));
    expect(screen.getByRole("button", { name: "Editar seg 16/11" })).toHaveFocus();
  });

  it("Salvar da tabela no cartão novo, sem digitar nada, inicia o cartão (os dias vazios viram falta)", async () => {
    jest.mocked(iniciarCartaoDoPontoAction).mockResolvedValue({ ok: true, data: undefined });
    render(<CartaoDePontoContainer folha={FOLHA_VAZIA} />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(iniciarCartaoDoPontoAction).toHaveBeenCalledWith({
      empregadoId: "e1",
      competencia: "2026-11",
    });
    expect(salvarDiaDoPontoAction).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/Cartão iniciado: os dias úteis sem horário viraram falta/),
    ).toBeInTheDocument();
  });

  it("cartão já iniciado, mesmo sem horário, mostra as faltas e não inicia de novo", async () => {
    jest.mocked(salvarDiaDoPontoAction).mockResolvedValue({ ok: true, data: undefined });
    const iniciado = {
      ...FOLHA_VAZIA,
      selecionado: { ...FOLHA_VAZIA.selecionado!, iniciado: true },
    };
    render(<CartaoDePontoContainer folha={iniciado} />);

    expect(screen.getByRole("button", { name: "Abonar seg 16/11" })).toBeInTheDocument();
    expect(screen.getByLabelText("Entrada 1 de seg 16/11")).toHaveAttribute("readonly");
    expect(iniciarCartaoDoPontoAction).not.toHaveBeenCalled();
  });

  it("erro ao iniciar o cartão aparece na barra da tabela", async () => {
    jest.mocked(iniciarCartaoDoPontoAction).mockResolvedValue({
      ok: false,
      error: { code: "forbidden", message: "Sem permissão." },
    } as never);
    render(<CartaoDePontoContainer folha={FOLHA_VAZIA} />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível iniciar o cartão: Sem permissão. Tente salvar de novo.",
    );
    expect(refresh).toHaveBeenCalled();
  });

  describe("Ler atestado", () => {
    const FOTO = new File([new Uint8Array([0xff, 0xd8])], "atestado.jpeg", { type: "image/jpeg" });
    const abrirModal = async (user: ReturnType<typeof userEvent.setup>) => {
      HTMLDialogElement.prototype.showModal = function () {
        this.setAttribute("open", "");
      };
      HTMLDialogElement.prototype.close = function () {
        this.removeAttribute("open");
      };
      await user.click(screen.getByRole("button", { name: "Ler atestado" }));
      await user.upload(screen.getByLabelText("Foto do atestado (JPEG ou PNG)"), FOTO);
    };

    it("só o Responsável (cartão editável) vê o botão", () => {
      const { unmount } = render(<CartaoDePontoContainer folha={FOLHA_VAZIA} />);
      expect(screen.getByRole("button", { name: "Ler atestado" })).toBeInTheDocument();
      unmount();

      render(<CartaoDePontoContainer folha={{ ...FOLHA_VAZIA, podeEditar: false }} />);
      expect(screen.queryByRole("button", { name: "Ler atestado" })).not.toBeInTheDocument();
    });

    it("sucesso atualiza a planilha (recarrega) e mostra o resumo no rodapé do cartão", async () => {
      jest
        .mocked(lerAtestadoDePontoAction)
        .mockResolvedValue({ ok: true, data: { tipo: "atestado", abonados: 1 } });
      render(<CartaoDePontoContainer folha={FOLHA_VAZIA} />);
      const user = userEvent.setup({ applyAccept: false });
      await abrirModal(user);

      await user.click(screen.getByRole("button", { name: "Abonar pelo atestado" }));

      await waitFor(() => expect(refresh).toHaveBeenCalled());
      expect(
        await screen.findByText("1 dia abonado pelo atestado. Confira o cartão."),
      ).toBeInTheDocument();
    });

    it("erro mantém a planilha como estava e mostra o motivo na modal", async () => {
      refresh.mockClear();
      jest.mocked(lerAtestadoDePontoAction).mockResolvedValue({
        ok: false,
        error: { code: "VALIDATION_ERROR", message: "O nome no atestado não confere com Ana." },
      });
      render(<CartaoDePontoContainer folha={FOLHA_VAZIA} />);
      const user = userEvent.setup({ applyAccept: false });
      await abrirModal(user);

      await user.click(screen.getByRole("button", { name: "Abonar pelo atestado" }));

      expect(await screen.findByText(/não confere com Ana/)).toBeInTheDocument();
      expect(refresh).not.toHaveBeenCalled();
    });
  });
});
