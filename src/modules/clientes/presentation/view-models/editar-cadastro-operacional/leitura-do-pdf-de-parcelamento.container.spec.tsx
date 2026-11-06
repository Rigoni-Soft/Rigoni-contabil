import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render as renderRtl, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { CadastroOperacionalClienteDto } from "@/modules/clientes/application/ports/out/cliente-query.provider";
import { ok } from "@/shared/kernel/result";

import { EditarCadastroOperacionalContainer } from "./editar-cadastro-operacional.container";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

// A action tem teste próprio; aqui a tela é testada contra o contrato dela (jsdom não tem File#arrayBuffer).
const lerMock = jest.fn();
jest.mock("./ler-pdf-de-parcelamento.actions", () => ({
  lerPdfDeParcelamentoAction: (...args: unknown[]) => lerMock(...args),
}));
const anexarGuiaMock = jest.fn();
jest.mock("../anexar-guia-parcela-pgfn/anexar-guia-parcela-pgfn.actions", () => ({
  anexarGuiaParcelaPgfnAction: (...args: unknown[]) => anexarGuiaMock(...args),
}));
const salvarParcelamentosMock = jest.fn();
const editarMock = jest.fn();
jest.mock("@/main/clientes.factory", () => ({
  makeEditarCadastroOperacionalCliente: () => ({ execute: editarMock }),
  makeSalvarParcelamentosCliente: () => ({ execute: salvarParcelamentosMock }),
  makeListarDocumentosContratuaisCliente: () => ({ execute: async () => ok([]) }),
  makeObterLinkDocumentoContratual: () => ({ execute: jest.fn() }),
}));

const dados: CadastroOperacionalClienteDto = {
  id: "9f1c9c6e-9d1a-4c9a-8b1e-2e2a4a5b6c7d",
  empresa: "Padaria Pão Quente Ltda",
  cnpj: "11444777000161",
  regime: "simples_nacional",
  formaEnvio: "whatsapp",
  contatos: [{ id: "c1", nome: "Maria", telefone: "11999990000", padrao: true }],
  documentoObrigatorio: "positivo",
  dasStatus: "pronto",
  dataEnvioDas: null,
  parcelamentos: [],
  observacoesGerais: "",
  atividadeMes: { industria: false, comercio: true, servico: false },
  responsavelId: null,
  responsavelNome: null,
};

const PARCELAMENTO_ID = "5b1c9c6e-9d1a-4c9a-8b1e-2e2a4a5b6c7e";
const okAction = <T,>(data: T) => ({ ok: true as const, data });

const pdf = new File([new Uint8Array([1, 2, 3])], "acordo.pdf", { type: "application/pdf" });

function render() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderRtl(
    <QueryClientProvider client={client}>
      <EditarCadastroOperacionalContainer dados={dados} readOnly={false} />
    </QueryClientProvider>,
  );
}

async function anexarPdfNoParcelamentoNovo(usuario: ReturnType<typeof userEvent.setup>) {
  // Cliente sem Parcelamentos já abre com uma linha em branco: o PDF vai nela.
  await usuario.upload(screen.getByLabelText(/pdf do acordo/i), pdf);
}

describe("Leitura do PDF de parcelamento no Editar cliente", () => {
  beforeEach(() => {
    lerMock.mockReset();
    salvarParcelamentosMock.mockReset();
    anexarGuiaMock.mockReset();
    editarMock.mockReset();
    editarMock.mockResolvedValue(ok({ clienteId: dados.id }));
    salvarParcelamentosMock.mockResolvedValue(ok({ ids: [PARCELAMENTO_ID] }));
  });

  it("enquanto lê: avisa, desabilita os campos da linha e o Salvar; depois sugere e libera", async () => {
    let terminar!: (v: unknown) => void;
    lerMock.mockReturnValue(new Promise((resolve) => (terminar = resolve)));
    const usuario = userEvent.setup();
    render();

    await anexarPdfNoParcelamentoNovo(usuario);

    expect(await screen.findByText("Lendo o PDF…")).toBeInTheDocument();
    expect(screen.getByLabelText(/código/i)).toBeDisabled();
    expect(screen.getByLabelText(/parcelas restantes/i)).toBeDisabled();
    const salvar = screen.getByRole("button", { name: /salvar/i });
    expect(salvar).toHaveAttribute("aria-disabled", "true");
    expect(salvar).toHaveAccessibleDescription("Aguarde a leitura do PDF para salvar.");
    await usuario.click(salvar);
    expect(editarMock).not.toHaveBeenCalled();

    terminar(
      okAction({ lido: true, codigo: "A-77", codigoGerado: false, quantidadeDeParcelas: 7 }),
    );

    expect(await screen.findByText("Sugerido pelo PDF: confira")).toBeInTheDocument();
    // O estado da leitura é a descrição dos campos sugeridos (o leitor de tela sabe que são sugestão).
    expect(screen.getByLabelText(/código/i)).toHaveAccessibleDescription(
      "Sugerido pelo PDF: confira",
    );
    expect(screen.getByLabelText(/parcelas restantes/i)).toHaveAccessibleDescription(
      "Sugerido pelo PDF: confira",
    );
    expect(screen.getByLabelText(/código/i)).toHaveValue("A-77");
    expect(screen.getByLabelText(/parcelas restantes/i)).toHaveValue(7);
    expect(screen.getByLabelText(/código/i)).toBeEnabled();
    expect(screen.getByRole("button", { name: /salvar/i })).toBeEnabled();
    expect(screen.queryByText("Aguarde a leitura do PDF para salvar.")).not.toBeInTheDocument();
  });

  it("a sugestão é editável: o valor corrigido é o que vai para o servidor", async () => {
    lerMock.mockResolvedValue(
      okAction({ lido: true, codigo: "A-77", codigoGerado: false, quantidadeDeParcelas: 7 }),
    );
    const usuario = userEvent.setup();
    render();
    await anexarPdfNoParcelamentoNovo(usuario);
    await screen.findByText("Sugerido pelo PDF: confira");

    await usuario.clear(screen.getByLabelText(/parcelas restantes/i));
    await usuario.type(screen.getByLabelText(/parcelas restantes/i), "5");
    await usuario.click(screen.getByRole("button", { name: /salvar/i }));

    await waitFor(() => expect(salvarParcelamentosMock).toHaveBeenCalled());
    expect(salvarParcelamentosMock.mock.calls[0][0].parcelamentos[0]).toMatchObject({
      codigo: "A-77",
      parcelasRestantes: 5,
    });
  });

  it("PDF sem código: avisa que o código foi gerado e pode ser trocado", async () => {
    lerMock.mockResolvedValue(
      okAction({
        lido: true,
        codigo: "PARC-1A2B3C4D",
        codigoGerado: true,
        quantidadeDeParcelas: 7,
      }),
    );
    const usuario = userEvent.setup();
    render();

    await anexarPdfNoParcelamentoNovo(usuario);

    expect(await screen.findByText(/o PDF não traz código/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/código/i)).toHaveValue("PARC-1A2B3C4D");
  });

  describe("dados do acordo e conferência do CNPJ", () => {
    const sugestao = (extra: Record<string, unknown> = {}) =>
      okAction({
        lido: true,
        codigo: "15014167",
        codigoGerado: false,
        quantidadeDeParcelas: 5,
        cnpjConfere: true,
        acordo: {
          origem: "pgfn",
          totalDeParcelas: 5,
          valorDaParcelaCentavos: 26289,
          dataDeAdesao: "2026-01-27",
        },
        ...extra,
      });

    it("guia anexada no cadastro: sobe depois de salvar, no Parcelamento criado, fora do corpo do salvar", async () => {
      lerMock.mockResolvedValue(sugestao());
      anexarGuiaMock.mockResolvedValue(okAction({}));
      const guia = new File([new Uint8Array([1])], "guia.pdf", { type: "application/pdf" });
      const usuario = userEvent.setup();
      render();
      await anexarPdfNoParcelamentoNovo(usuario);
      await usuario.upload(await screen.findByLabelText(/pdf da guia \(opcional\)/i), guia);

      await usuario.click(screen.getByRole("button", { name: /salvar/i }));

      await waitFor(() => expect(anexarGuiaMock).toHaveBeenCalled());
      expect(anexarGuiaMock.mock.calls[0][0]).toEqual({
        parcelamentoId: PARCELAMENTO_ID,
        arquivo: guia,
      });
      expect(salvarParcelamentosMock.mock.calls[0][0].parcelamentos[0]).not.toHaveProperty("guia");
    });

    it("PDF do acordo trocado por um que não é da PGFN: a guia escolhida não é enviada", async () => {
      lerMock.mockResolvedValueOnce(sugestao());
      lerMock.mockResolvedValueOnce(
        sugestao({
          acordo: {
            origem: "receita_federal",
            totalDeParcelas: 5,
            valorDaParcelaCentavos: 26289,
            dataDeAdesao: "2026-01-27",
          },
        }),
      );
      const guia = new File([new Uint8Array([1])], "guia.pdf", { type: "application/pdf" });
      const usuario = userEvent.setup();
      render();
      await anexarPdfNoParcelamentoNovo(usuario);
      await usuario.upload(await screen.findByLabelText(/pdf da guia \(opcional\)/i), guia);

      await usuario.upload(
        screen.getByLabelText(/pdf do acordo/i),
        new File([new Uint8Array([2])], "outro.pdf", { type: "application/pdf" }),
      );
      await waitFor(() =>
        expect(screen.queryByLabelText(/pdf da guia \(opcional\)/i)).not.toBeInTheDocument(),
      );
      await usuario.click(screen.getByRole("button", { name: /salvar/i }));

      await waitFor(() => expect(salvarParcelamentosMock).toHaveBeenCalled());
      expect(anexarGuiaMock).not.toHaveBeenCalled();
    });

    it("sem guia no cadastro: não chama o anexo", async () => {
      lerMock.mockResolvedValue(sugestao());
      const usuario = userEvent.setup();
      render();
      await anexarPdfNoParcelamentoNovo(usuario);
      await usuario.click(screen.getByRole("button", { name: /salvar/i }));

      await waitFor(() => expect(salvarParcelamentosMock).toHaveBeenCalled());
      expect(anexarGuiaMock).not.toHaveBeenCalled();
    });

    it("guia recusada (CNPJ de outra empresa): o Parcelamento fica salvo e a tela avisa", async () => {
      lerMock.mockResolvedValue(sugestao());
      anexarGuiaMock.mockResolvedValue({
        ok: false,
        error: { code: "VALIDATION_ERROR", message: "O CNPJ da guia é de outra empresa." },
      });
      const guia = new File([new Uint8Array([1])], "guia.pdf", { type: "application/pdf" });
      const usuario = userEvent.setup();
      render();
      await anexarPdfNoParcelamentoNovo(usuario);
      await usuario.upload(await screen.findByLabelText(/pdf da guia \(opcional\)/i), guia);

      await usuario.click(screen.getByRole("button", { name: /salvar/i }));

      expect(
        await screen.findByText(/Parcelamento foi salvo, mas a guia não foi anexada/),
      ).toBeInTheDocument();
      // O motivo vem no aviso do formulário, com o caminho certo: anexar na região "Guias da parcela".
      expect(screen.getByText(/O CNPJ da guia é de outra empresa\./)).toBeInTheDocument();
      expect(salvarParcelamentosMock).toHaveBeenCalledTimes(1);
    });

    it("guia recusada e novo Salvar: atualiza o acordo já salvo (mesmo id) e não reenvia a guia (F4 da PR #194)", async () => {
      lerMock.mockResolvedValue(sugestao());
      anexarGuiaMock.mockResolvedValue({
        ok: false,
        error: { code: "VALIDATION_ERROR", message: "O CNPJ da guia é de outra empresa." },
      });
      const guia = new File([new Uint8Array([1])], "guia.pdf", { type: "application/pdf" });
      const usuario = userEvent.setup();
      render();
      await anexarPdfNoParcelamentoNovo(usuario);
      await usuario.upload(await screen.findByLabelText(/pdf da guia \(opcional\)/i), guia);
      await usuario.click(screen.getByRole("button", { name: /salvar/i }));
      await screen.findByText(/Parcelamento foi salvo, mas a guia não foi anexada/);

      await usuario.click(screen.getByRole("button", { name: /salvar/i }));

      await waitFor(() => expect(salvarParcelamentosMock).toHaveBeenCalledTimes(2));
      expect(salvarParcelamentosMock.mock.calls[1][0].parcelamentos[0].id).toBe(PARCELAMENTO_ID);
      expect(anexarGuiaMock).toHaveBeenCalledTimes(1);
    });

    it("linha em branco antes do acordo: o id volta à linha do acordo, não à vazia, e a retentativa o atualiza (F4 da PR #194)", async () => {
      lerMock.mockResolvedValue(sugestao());
      anexarGuiaMock.mockResolvedValue({
        ok: false,
        error: { code: "VALIDATION_ERROR", message: "O CNPJ da guia é de outra empresa." },
      });
      const guia = new File([new Uint8Array([1])], "guia.pdf", { type: "application/pdf" });
      const usuario = userEvent.setup();
      render();
      // A primeira linha (a que o cliente sem Parcelamentos já abre) fica vazia; o acordo vai na segunda.
      await usuario.click(screen.getByRole("button", { name: /adicionar parcelamento/i }));
      await usuario.upload(screen.getAllByLabelText(/pdf do acordo/i)[1], pdf);
      await usuario.upload(await screen.findByLabelText(/pdf da guia \(opcional\)/i), guia);
      await usuario.click(screen.getByRole("button", { name: /salvar/i }));
      await screen.findByText(/Parcelamento foi salvo, mas a guia não foi anexada/);

      await usuario.click(screen.getByRole("button", { name: /salvar/i }));

      await waitFor(() => expect(salvarParcelamentosMock).toHaveBeenCalledTimes(2));
      const reenviados = salvarParcelamentosMock.mock.calls[1][0].parcelamentos;
      expect(reenviados).toHaveLength(1);
      expect(reenviados[0].id).toBe(PARCELAMENTO_ID);
    });

    it("lê pelo Cliente da tela e mostra o resumo do acordo; salvar leva o acordo junto", async () => {
      lerMock.mockResolvedValue(sugestao());
      const usuario = userEvent.setup();
      render();

      await anexarPdfNoParcelamentoNovo(usuario);

      expect(
        await screen.findByText(/PGFN · 5 parcelas · R\$\s?262,89 · adesão 27\/01\/2026/),
      ).toBeInTheDocument();
      expect(lerMock.mock.calls[0][0]).toMatchObject({ clienteId: dados.id });
      expect(screen.queryByText(/CNPJ do PDF/i)).not.toBeInTheDocument();

      await usuario.click(screen.getByRole("button", { name: /salvar/i }));
      await waitFor(() => expect(salvarParcelamentosMock).toHaveBeenCalled());
      expect(salvarParcelamentosMock.mock.calls[0][0].parcelamentos[0].acordo).toEqual({
        origem: "pgfn",
        totalDeParcelas: 5,
        valorDaParcelaCentavos: 26289,
        dataDeAdesao: "2026-01-27",
      });
    });

    it("CNPJ do PDF diferente do Cliente: alerta próprio, com o que fazer, sem bloquear o salvar", async () => {
      lerMock.mockResolvedValue(sugestao({ cnpjConfere: false }));
      const usuario = userEvent.setup();
      render();

      await anexarPdfNoParcelamentoNovo(usuario);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "O CNPJ do PDF é diferente do CNPJ do Cliente. Confira se anexou o PDF certo.",
      );
      // O estado da leitura continua dizendo só o que foi sugerido.
      expect(screen.getByText("Sugerido pelo PDF: confira")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /salvar/i })).toBeEnabled();
    });

    it("trocar o PDF por um do mesmo Cliente tira o alerta de CNPJ", async () => {
      lerMock
        .mockResolvedValueOnce(sugestao({ cnpjConfere: false }))
        .mockResolvedValueOnce(sugestao({ cnpjConfere: true }));
      const usuario = userEvent.setup();
      render();
      await anexarPdfNoParcelamentoNovo(usuario);
      await screen.findByRole("alert");

      await usuario.upload(
        screen.getByLabelText(/pdf do acordo/i),
        new File([new Uint8Array([7])], "certo.pdf", { type: "application/pdf" }),
      );

      await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    });
  });

  describe("endurecimento da leitura", () => {
    const comAcordo = okAction({
      lido: true,
      codigo: "15014167",
      codigoGerado: false,
      quantidadeDeParcelas: 5,
      cnpjConfere: true,
      acordo: {
        origem: "pgfn",
        totalDeParcelas: 5,
        valorDaParcelaCentavos: 26289,
        dataDeAdesao: "2026-01-27",
      },
    });
    const outroPdf = new File([new Uint8Array([9, 9])], "outro.pdf", { type: "application/pdf" });

    it.each([
      [
        "o novo PDF não é lido",
        () =>
          lerMock
            .mockResolvedValueOnce(comAcordo)
            .mockResolvedValueOnce(okAction({ lido: false, motivo: "ilegivel" })),
      ],
      [
        "a leitura do novo PDF lança",
        () => lerMock.mockResolvedValueOnce(comAcordo).mockRejectedValueOnce(new Error("rede")),
      ],
    ])("%s: o acordo do PDF anterior não é gravado nem mostrado", async (_n, preparar) => {
      preparar();
      const usuario = userEvent.setup();
      render();
      await anexarPdfNoParcelamentoNovo(usuario);
      expect(await screen.findByText(/PGFN · 5 parcelas/)).toBeInTheDocument();

      await usuario.upload(screen.getByLabelText(/pdf do acordo/i), outroPdf);

      expect(await screen.findByText("não consegui ler: digite à mão")).toBeInTheDocument();
      expect(screen.queryByText(/PGFN · 5 parcelas/)).not.toBeInTheDocument();
      await usuario.click(screen.getByRole("button", { name: /salvar/i }));
      await waitFor(() => expect(salvarParcelamentosMock).toHaveBeenCalled());
      expect(salvarParcelamentosMock.mock.calls[0][0].parcelamentos[0].acordo).toBeUndefined();
    });

    it("enquanto relê, o acordo do PDF anterior some da tela", async () => {
      lerMock.mockResolvedValueOnce(comAcordo).mockReturnValueOnce(new Promise(() => undefined));
      const usuario = userEvent.setup();
      render();
      await anexarPdfNoParcelamentoNovo(usuario);
      expect(await screen.findByText(/PGFN · 5 parcelas/)).toBeInTheDocument();

      await usuario.upload(screen.getByLabelText(/pdf do acordo/i), outroPdf);

      expect(await screen.findByText("Lendo o PDF…")).toBeInTheDocument();
      expect(screen.queryByText(/PGFN · 5 parcelas/)).not.toBeInTheDocument();
    });

    it("leitura que nunca responde: depois do tempo limite cai no 'digite à mão' e libera o Salvar", async () => {
      jest.useFakeTimers({ advanceTimers: true });
      try {
        lerMock.mockReturnValue(new Promise(() => undefined));
        const usuario = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
        render();
        await anexarPdfNoParcelamentoNovo(usuario);
        expect(await screen.findByText("Lendo o PDF…")).toBeInTheDocument();

        await act(async () => {
          jest.advanceTimersByTime(21_000);
        });

        expect(await screen.findByText("não consegui ler: digite à mão")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /salvar/i })).not.toHaveAttribute(
          "aria-disabled",
        );
      } finally {
        jest.useRealTimers();
      }
    });

    it("remover a linha durante a leitura libera o Salvar e descarta a resposta tardia", async () => {
      let terminar!: (v: unknown) => void;
      lerMock.mockReturnValue(new Promise((resolve) => (terminar = resolve)));
      const usuario = userEvent.setup();
      render();
      await anexarPdfNoParcelamentoNovo(usuario);
      expect(await screen.findByText("Lendo o PDF…")).toBeInTheDocument();

      await usuario.click(screen.getByRole("button", { name: /remover parcelamento 1/i }));

      expect(screen.getByRole("button", { name: /salvar/i })).not.toHaveAttribute("aria-disabled");
      await act(async () => terminar(comAcordo));
      expect(screen.queryByText(/PGFN · 5 parcelas/)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/código/i)).not.toBeInTheDocument();
    });

    it("Limpar durante a leitura desfaz a linha, libera o Salvar e descarta a resposta tardia", async () => {
      let terminar!: (v: unknown) => void;
      lerMock.mockReturnValue(new Promise((resolve) => (terminar = resolve)));
      const usuario = userEvent.setup();
      render();
      await anexarPdfNoParcelamentoNovo(usuario);
      expect(await screen.findByText("Lendo o PDF…")).toBeInTheDocument();

      await usuario.click(screen.getByRole("button", { name: /limpar/i }));

      expect(screen.queryByText("Lendo o PDF…")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /salvar/i })).not.toHaveAttribute("aria-disabled");
      await act(async () => terminar(comAcordo));
      expect(screen.queryByText(/PGFN · 5 parcelas/)).not.toBeInTheDocument();
      // A linha volta ao estado de nascença: em branco, sem a sugestão da resposta tardia.
      expect(screen.getByLabelText(/código/i)).toHaveValue("");
    });

    it("Enter num campo enquanto lê não envia nem acusa erro nos campos que a leitura vai preencher", async () => {
      lerMock.mockReturnValue(new Promise(() => undefined));
      const usuario = userEvent.setup();
      render();
      await anexarPdfNoParcelamentoNovo(usuario);
      await screen.findByText("Lendo o PDF…");

      // Num <input> o Enter envia o formulário (no textarea seria só uma quebra de linha).
      await usuario.type(screen.getByDisplayValue("Maria"), "{Enter}");

      expect(editarMock).not.toHaveBeenCalled();
      expect(screen.queryByText("obrigatório")).not.toBeInTheDocument();
    });
  });

  it.each([
    [
      "leitura que falha",
      () => lerMock.mockResolvedValue(okAction({ lido: false, motivo: "ilegivel" })),
    ],
    ["Server Action que rejeita", () => lerMock.mockRejectedValue(new Error("rede"))],
  ])(
    "%s: 'não consegui ler: digite à mão', campos livres e o salvar segue possível",
    async (_n, preparar) => {
      preparar();
      const usuario = userEvent.setup();
      render();
      await anexarPdfNoParcelamentoNovo(usuario);

      expect(await screen.findByText("não consegui ler: digite à mão")).toBeInTheDocument();
      expect(screen.getByLabelText(/código/i)).toBeEnabled();
      expect(screen.getByRole("button", { name: /salvar/i })).toBeEnabled();

      await usuario.type(screen.getByLabelText(/código/i), "MANUAL-9");
      await usuario.click(screen.getByRole("button", { name: /salvar/i }));

      await waitFor(() => expect(salvarParcelamentosMock).toHaveBeenCalled());
      expect(salvarParcelamentosMock.mock.calls[0][0].parcelamentos[0].codigo).toBe("MANUAL-9");
    },
  );

  it("PDFs que somam mais de 4 MB: mostra o erro da lista, não salva e volta a salvar ao reduzir", async () => {
    lerMock.mockResolvedValue(okAction({ lido: false, motivo: "ilegivel" }));
    const grande = (nome: string) =>
      new File([new Uint8Array(3 * 1024 * 1024)], nome, { type: "application/pdf" });
    const usuario = userEvent.setup();
    render();

    await usuario.click(screen.getByRole("button", { name: /adicionar parcelamento/i }));
    const [campoA, campoB] = screen.getAllByLabelText(/pdf do acordo/i);
    await usuario.upload(campoA, grande("a.pdf"));
    await usuario.upload(campoB, grande("b.pdf"));
    const [codigoA, codigoB] = screen.getAllByLabelText(/código/i);
    const [parcelasA, parcelasB] = screen.getAllByLabelText(/parcelas restantes/i);
    await usuario.type(codigoA, "A-1");
    await usuario.type(codigoB, "B-1");
    await usuario.type(parcelasA, "3");
    await usuario.type(parcelasB, "3");

    await usuario.click(screen.getByRole("button", { name: /salvar/i }));

    expect(await screen.findByText(/somam mais de 4 MB/)).toBeInTheDocument();
    expect(editarMock).not.toHaveBeenCalled();
    expect(salvarParcelamentosMock).not.toHaveBeenCalled();

    await usuario.upload(
      screen.getAllByLabelText(/pdf do acordo/i)[1],
      new File([new Uint8Array(8)], "b.pdf", { type: "application/pdf" }),
    );
    await usuario.click(screen.getByRole("button", { name: /salvar/i }));

    await waitFor(() => expect(salvarParcelamentosMock).toHaveBeenCalled());
    expect(salvarParcelamentosMock.mock.calls[0][0].parcelamentos[0].arquivo.name).toBe("a.pdf");
  });
});
